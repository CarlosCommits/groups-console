import { QueryClient } from "@tanstack/react-query";
import type * as ReactQuery from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipientsSearchResult } from "@/shared/contracts/recipients";

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof ReactQuery>(
    "@tanstack/react-query",
  );

  return {
    ...actual,
    useQuery: useQueryMock,
  };
});

import {
  getRecipientsSearchQueryOptions,
  invalidateRecipientsSearchQueryForConnection,
  useRecipientsSearchQuery,
} from "./use-recipients-search";

function makeSearchResult(overrides: Partial<RecipientsSearchResult> = {}): RecipientsSearchResult {
  return {
    query: "test",
    appliedLimit: 50,
    appliedTypes: ["mailbox"],
    sourceStatus: {
      exchange: "searched",
      graph: "searched",
    },
    items: [
      {
        source: "exchange",
        stableKey: "exchange:objectId:mailbox:1",
        recipientType: "mailbox",
        membershipSupport: "exchangeDirect",
        objectId: "obj-1",
        exchangeIdentity: "user@example.com",
        primaryEmail: "user@example.com",
        displayName: "Test User",
        alias: "testuser",
        recipientTypeDetails: "UserMailbox",
        companyName: "Example Corp",
        companySource: "exchange",
      },
    ],
    ...overrides,
  };
}

function makeCommandFailure() {
  const err = new Error("Search bridge timed out") as Error & {
    code: string;
    retryable: boolean;
    details: string;
    classification: {
      category: string;
      remediation: string;
      backend: string;
      operation: string;
      guidance: string;
    };
  };

  err.name = "CommandFailure";
  err.code = "recipients_timeout";
  err.retryable = true;
  err.details = "Recipient search timed out.";
  err.classification = {
    category: "connectionFailure",
    remediation: "reconnect",
    backend: "exchange",
    operation: "recipients.search",
    guidance: "Reconnect to Exchange Online.",
  };

  return err;
}

describe("useRecipientsSearchQuery", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
  });

  it("configures the shared query as disabled when the caller disables search", () => {
    const refetch = vi.fn(() => Promise.resolve(undefined));

    useQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      isFetching: false,
      refetch,
    });

    const result = useRecipientsSearchQuery(
      "disconnected:none:none:none",
      "test",
      ["mailbox"],
      false,
    );

    const [options] = useQueryMock.mock.calls[0] as [
      ReturnType<typeof getRecipientsSearchQueryOptions>,
    ];

    expect(options.enabled).toBe(false);
    expect(result.results).toBeNull();
    expect(result.error).toBeNull();
  });

  it("configures the shared query as disabled when query is too short", () => {
    const refetch = vi.fn(() => Promise.resolve(undefined));

    useQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      isFetching: false,
      refetch,
    });

    useRecipientsSearchQuery(
      "connected:tenant-a:exchange-a:admin@example.com",
      "a",
      ["mailbox"],
    );

    const [options] = useQueryMock.mock.calls[0] as [
      ReturnType<typeof getRecipientsSearchQueryOptions>,
    ];

    expect(options.enabled).toBe(false);
  });

  it("maps successful query data into the shared screen-facing shape", () => {
    const refetch = vi.fn(() => Promise.resolve(undefined));
    const data = makeSearchResult();

    useQueryMock.mockReturnValue({
      data,
      error: null,
      isLoading: false,
      isFetching: true,
      refetch,
    });

    const result = useRecipientsSearchQuery(
      "connected:tenant-a:exchange-a:admin@example.com",
      "test",
      ["mailbox"],
    );

    expect(result.results).toEqual(data);
    expect(result.isLoading).toBe(false);
    expect(result.isFetching).toBe(true);
    expect(result.error).toBeNull();
    expect(result.errorPresentation).toBeNull();
  });

  it("formats query failures with the shared command failure presenter", () => {
    const refetch = vi.fn(() => Promise.resolve(undefined));

    useQueryMock.mockReturnValue({
      data: undefined,
      error: makeCommandFailure(),
      isLoading: false,
      isFetching: false,
      refetch,
    });

    const result = useRecipientsSearchQuery(
      "connected:tenant-a:exchange-a:admin@example.com",
      "test",
      ["mailbox"],
    );

    expect(result.errorPresentation).toMatchObject({
      title: "Connection Failed",
      body: "Recipient search timed out.",
      guidance: "Reconnect to Exchange Online.",
      severity: "error",
      retryable: true,
    });
    expect(result.error).toBe("Recipient search timed out. Reconnect to Exchange Online.");
  });
});

describe("getRecipientsSearchQueryOptions", () => {
  const searchMock = vi.fn<() => Promise<RecipientsSearchResult>>();

  beforeEach(() => {
    searchMock.mockReset();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        groupsConsole: {
          recipients: {
            search: searchMock,
          },
        },
      },
    });
  });

  it("reuses the cached search result for the same connection identity and query", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    const result = makeSearchResult();
    searchMock.mockResolvedValue(result);

    const options = getRecipientsSearchQueryOptions(
      "connected:tenant-a:exchange-a:admin@example.com",
      "test",
      ["mailbox"],
      true,
    );

    await queryClient.fetchQuery(options);
    await queryClient.fetchQuery(options);

    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(options.queryKey)).toEqual(result);
  });

  it("isolates cached search results by connection identity", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    const tenantAResult = makeSearchResult();
    const tenantBResult = makeSearchResult({
      items: [],
    });

    searchMock
      .mockResolvedValueOnce(tenantAResult)
      .mockResolvedValueOnce(tenantBResult);

    const tenantAOptions = getRecipientsSearchQueryOptions(
      "connected:tenant-a:exchange-a:admin@example.com",
      "test",
      ["mailbox"],
      true,
    );
    const tenantBOptions = getRecipientsSearchQueryOptions(
      "connected:tenant-b:exchange-b:admin@example.com",
      "test",
      ["mailbox"],
      true,
    );

    await queryClient.fetchQuery(tenantAOptions);
    await queryClient.fetchQuery(tenantBOptions);

    expect(searchMock).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryData(tenantAOptions.queryKey)).toEqual(tenantAResult);
    expect(queryClient.getQueryData(tenantBOptions.queryKey)).toEqual(tenantBResult);
  });

  it("invalidates only the current connection search scope", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    const tenantAOptions = getRecipientsSearchQueryOptions(
      "connected:tenant-a:exchange-a:admin@example.com",
      "test",
      ["mailbox"],
      true,
    );
    const tenantBOptions = getRecipientsSearchQueryOptions(
      "connected:tenant-b:exchange-b:admin@example.com",
      "test",
      ["mailbox"],
      true,
    );

    queryClient.setQueryData(tenantAOptions.queryKey, makeSearchResult());
    queryClient.setQueryData(tenantBOptions.queryKey, makeSearchResult({ items: [] }));

    await invalidateRecipientsSearchQueryForConnection(
      queryClient,
      "connected:tenant-a:exchange-a:admin@example.com",
    );

    expect(queryClient.getQueryState(tenantAOptions.queryKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(tenantBOptions.queryKey)?.isInvalidated).toBe(false);
  });
});
