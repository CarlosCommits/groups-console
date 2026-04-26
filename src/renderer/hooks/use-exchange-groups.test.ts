import { QueryClient } from "@tanstack/react-query";
import type * as ReactQuery from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExchangeListGroupsResult } from "@/shared/contracts/exchange";

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
  getExchangeGroupsQueryOptions,
  invalidateExchangeGroupsQueryForConnection,
  useExchangeGroupsQuery,
} from "./use-exchange-groups";

function makeGroupsResult(overrides: Partial<ExchangeListGroupsResult> = {}): ExchangeListGroupsResult {
  return {
    appliedKind: "all",
    items: [
      {
        objectId: "group-1",
        exchangeIdentity: "group-1@example.com",
        displayName: "Group One",
        alias: "group-one",
        primaryEmail: "group-1@example.com",
        groupKind: "distributionList",
        managedByDisplayNames: [],
        whenChangedUtc: "2026-04-18T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

function makeCommandFailure() {
  const err = new Error("Exchange bridge timed out") as Error & {
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
  err.code = "exchange_timeout";
  err.retryable = true;
  err.details = "Exchange request timed out.";
  err.classification = {
    category: "connectionFailure",
    remediation: "reconnect",
    backend: "exchange",
    operation: "exchange.listGroups",
    guidance: "Reconnect to Exchange Online.",
  };

  return err;
}

describe("useExchangeGroupsQuery", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
  });

  it("configures the shared query as disabled when Exchange is disconnected", () => {
    const refetch = vi.fn(() => Promise.resolve(undefined));

    useQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      isFetching: false,
      refetch,
    });

    const result = useExchangeGroupsQuery({
      state: "disconnected",
      tenantId: null,
      connectionId: null,
      userPrincipalName: null,
    });

    const [options] = useQueryMock.mock.calls[0] as [
      ReturnType<typeof getExchangeGroupsQueryOptions>,
    ];

    expect(options.enabled).toBe(false);
    expect(options.queryKey).toEqual([
      "console",
      "exchange",
      "disconnected:none:none:none",
      "groups",
      "list",
    ]);
    expect(result.groups).toEqual([]);
    expect(result.appliedKind).toBeNull();
    expect(result.error).toBeNull();
  });

  it("maps successful query data into the shared screen-facing shape", () => {
    const refetch = vi.fn(() => Promise.resolve(undefined));
    const data = makeGroupsResult();

    useQueryMock.mockReturnValue({
      data,
      error: null,
      isLoading: false,
      isFetching: true,
      refetch,
    });

    const result = useExchangeGroupsQuery({
      state: "connected",
      tenantId: "tenant-a",
      connectionId: "exchange-connection-a",
      userPrincipalName: "admin@example.com",
    });

    expect(result.groups).toEqual(data.items);
    expect(result.appliedKind).toBe("all");
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

    const result = useExchangeGroupsQuery({
      state: "connected",
      tenantId: "tenant-a",
      connectionId: "exchange-connection-a",
      userPrincipalName: "admin@example.com",
    });

    expect(result.errorPresentation).toMatchObject({
      title: "Connection Failed",
      body: "Exchange request timed out.",
      guidance: "Reconnect to Exchange Online.",
      severity: "error",
      retryable: true,
    });
    expect(result.error).toBe("Exchange request timed out. Reconnect to Exchange Online.");
  });
});

describe("getExchangeGroupsQueryOptions", () => {
  const listGroupsMock = vi.fn<() => Promise<ExchangeListGroupsResult>>();

  beforeEach(() => {
    listGroupsMock.mockReset();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        groupsConsole: {
          exchange: {
            listGroups: listGroupsMock,
          },
        },
      },
    });
  });

  it("reuses the cached groups inventory for the same connection identity", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    const result = makeGroupsResult();
    listGroupsMock.mockResolvedValue(result);

    const options = getExchangeGroupsQueryOptions("connected:tenant-a:exchange-a:admin@example.com", true);

    await queryClient.fetchQuery(options);
    await queryClient.fetchQuery(options);

    expect(listGroupsMock).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(options.queryKey)).toEqual(result);
  });

  it("isolates cached groups inventory by connection identity", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    const tenantAResult = makeGroupsResult();
    const tenantBResult = makeGroupsResult({
      items: [
        {
          objectId: "group-2",
          exchangeIdentity: "group-2@example.com",
          displayName: "Group Two",
          alias: "group-two",
          primaryEmail: "group-2@example.com",
          groupKind: "mailEnabledSecurityGroup",
          managedByDisplayNames: [],
          whenChangedUtc: null,
        },
      ],
    });

    listGroupsMock
      .mockResolvedValueOnce(tenantAResult)
      .mockResolvedValueOnce(tenantBResult);

    const tenantAOptions = getExchangeGroupsQueryOptions(
      "connected:tenant-a:exchange-a:admin@example.com",
      true,
    );
    const tenantBOptions = getExchangeGroupsQueryOptions(
      "connected:tenant-b:exchange-b:admin@example.com",
      true,
    );

    await queryClient.fetchQuery(tenantAOptions);
    await queryClient.fetchQuery(tenantBOptions);

    expect(listGroupsMock).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryData(tenantAOptions.queryKey)).toEqual(tenantAResult);
    expect(queryClient.getQueryData(tenantBOptions.queryKey)).toEqual(tenantBResult);
  });

  it("invalidates only the current connection inventory scope", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    const tenantAOptions = getExchangeGroupsQueryOptions(
      "connected:tenant-a:exchange-a:admin@example.com",
      true,
    );
    const tenantBOptions = getExchangeGroupsQueryOptions(
      "connected:tenant-b:exchange-b:admin@example.com",
      true,
    );

    queryClient.setQueryData(tenantAOptions.queryKey, makeGroupsResult());
    queryClient.setQueryData(
      tenantBOptions.queryKey,
      makeGroupsResult({
        items: [],
      }),
    );

    await invalidateExchangeGroupsQueryForConnection(queryClient, {
      state: "connected",
      tenantId: "tenant-a",
      connectionId: "exchange-a",
      userPrincipalName: "admin@example.com",
    });

    expect(queryClient.getQueryState(tenantAOptions.queryKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(tenantBOptions.queryKey)?.isInvalidated).toBe(false);
  });
});
