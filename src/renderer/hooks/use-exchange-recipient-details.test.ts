import { QueryClient } from "@tanstack/react-query";
import type * as ReactQuery from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExchangeRecipientGetDetailsResult } from "@/shared/contracts/exchange";

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
  getExchangeRecipientDetailsQueryOptions,
  invalidateExchangeRecipientDetailsQuery,
  removeExchangeRecipientDetailsQuery,
  useExchangeRecipientDetailsQuery,
} from "./use-exchange-recipient-details";

function makeRecipientDetailsResult(): ExchangeRecipientGetDetailsResult {
  return {
    recipient: {
      exchangeIdentity: "shared@example.com",
      objectId: "recipient-mailbox-1",
      primaryEmail: "shared@example.com",
      externalEmailAddress: null,
      displayName: "Shared Mailbox",
      alias: "shared-mailbox",
      companyName: "Example Corp",
      firstName: null,
      lastName: null,
      title: null,
      department: null,
      phone: null,
      office: null,
      userPrincipalName: "shared@example.com",
      recipientType: "mailbox",
      recipientTypeDetails: "SharedMailbox",
    },
  };
}

function makeCommandFailure() {
  const err = new Error("Recipient details bridge timed out") as Error & {
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
  err.code = "exchange_recipient_timeout";
  err.retryable = true;
  err.details = "Recipient details request timed out.";
  err.classification = {
    category: "connectionFailure",
    remediation: "reconnect",
    backend: "exchange",
    operation: "exchange.getRecipientDetails",
    guidance: "Reconnect to Exchange Online.",
  };

  return err;
}

describe("useExchangeRecipientDetailsQuery", () => {
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

    const result = useExchangeRecipientDetailsQuery(
      {
        state: "disconnected",
        tenantId: null,
        connectionId: null,
        userPrincipalName: null,
      },
      "exchange:objectId:mailbox:1",
    );

    const [options] = useQueryMock.mock.calls[0] as [
      ReturnType<typeof getExchangeRecipientDetailsQueryOptions>,
    ];

    expect(options.enabled).toBe(false);
    expect(result.recipient).toBeNull();
    expect(result.error).toBeNull();
  });

  it("configures the shared query as disabled when no stable key is provided", () => {
    const refetch = vi.fn(() => Promise.resolve(undefined));

    useQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      isFetching: false,
      refetch,
    });

    useExchangeRecipientDetailsQuery(
      {
        state: "connected",
        tenantId: "tenant-a",
        connectionId: "exchange-a",
        userPrincipalName: "admin@example.com",
      },
      undefined,
    );

    const [options] = useQueryMock.mock.calls[0] as [
      ReturnType<typeof getExchangeRecipientDetailsQueryOptions>,
    ];

    expect(options.enabled).toBe(false);
  });

  it("does not allow an explicit enabled flag to bypass a disconnected Exchange session", () => {
    const refetch = vi.fn(() => Promise.resolve(undefined));

    useQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      isFetching: false,
      refetch,
    });

    useExchangeRecipientDetailsQuery(
      {
        state: "disconnected",
        tenantId: null,
        connectionId: null,
        userPrincipalName: null,
      },
      "exchange:objectId:mailbox:1",
      true,
    );

    const [options] = useQueryMock.mock.calls[0] as [
      ReturnType<typeof getExchangeRecipientDetailsQueryOptions>,
    ];

    expect(options.enabled).toBe(false);
  });

  it("maps successful query data into the shared screen-facing shape", () => {
    const refetch = vi.fn(() => Promise.resolve(undefined));
    const data = makeRecipientDetailsResult();

    useQueryMock.mockReturnValue({
      data,
      error: null,
      isLoading: false,
      isFetching: true,
      refetch,
    });

    const result = useExchangeRecipientDetailsQuery(
      {
        state: "connected",
        tenantId: "tenant-a",
        connectionId: "exchange-a",
        userPrincipalName: "admin@example.com",
      },
      "exchange:objectId:mailbox:1",
    );

    expect(result.recipient).toEqual(data.recipient);
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

    const result = useExchangeRecipientDetailsQuery(
      {
        state: "connected",
        tenantId: "tenant-a",
        connectionId: "exchange-a",
        userPrincipalName: "admin@example.com",
      },
      "exchange:objectId:mailbox:1",
    );

    expect(result.errorPresentation).toMatchObject({
      title: "Connection Failed",
      body: "Recipient details request timed out.",
      guidance: "Reconnect to Exchange Online.",
      severity: "error",
      retryable: true,
    });
    expect(result.error).toBe("Recipient details request timed out. Reconnect to Exchange Online.");
  });
});

describe("getExchangeRecipientDetailsQueryOptions", () => {
  const getRecipientDetailsMock = vi.fn<() => Promise<ExchangeRecipientGetDetailsResult>>();

  beforeEach(() => {
    getRecipientDetailsMock.mockReset();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        groupsConsole: {
          exchange: {
            getRecipientDetails: getRecipientDetailsMock,
          },
        },
      },
    });
  });

  it("reuses the cached recipient details for the same connection and stable key", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    const result = makeRecipientDetailsResult();
    getRecipientDetailsMock.mockResolvedValue(result);

    const options = getExchangeRecipientDetailsQueryOptions(
      "connected:tenant-a:exchange-a:admin@example.com",
      "exchange:objectId:mailbox:1",
      true,
    );

    await queryClient.fetchQuery(options);
    await queryClient.fetchQuery(options);

    expect(getRecipientDetailsMock).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(options.queryKey)).toEqual(result);
  });

  it("isolates cached recipient details by connection identity", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    const tenantAResult = makeRecipientDetailsResult();
    const tenantBResult = makeRecipientDetailsResult();

    getRecipientDetailsMock
      .mockResolvedValueOnce(tenantAResult)
      .mockResolvedValueOnce(tenantBResult);

    const tenantAOptions = getExchangeRecipientDetailsQueryOptions(
      "connected:tenant-a:exchange-a:admin@example.com",
      "exchange:objectId:mailbox:1",
      true,
    );
    const tenantBOptions = getExchangeRecipientDetailsQueryOptions(
      "connected:tenant-b:exchange-b:admin@example.com",
      "exchange:objectId:mailbox:1",
      true,
    );

    await queryClient.fetchQuery(tenantAOptions);
    await queryClient.fetchQuery(tenantBOptions);

    expect(getRecipientDetailsMock).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryData(tenantAOptions.queryKey)).toEqual(tenantAResult);
    expect(queryClient.getQueryData(tenantBOptions.queryKey)).toEqual(tenantBResult);
  });

  it("invalidates only the current recipient details scope", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    const recipientAOptions = getExchangeRecipientDetailsQueryOptions(
      "connected:tenant-a:exchange-a:admin@example.com",
      "exchange:objectId:mailbox:1",
      true,
    );
    const recipientBOptions = getExchangeRecipientDetailsQueryOptions(
      "connected:tenant-a:exchange-a:admin@example.com",
      "exchange:objectId:mailbox:2",
      true,
    );

    queryClient.setQueryData(recipientAOptions.queryKey, makeRecipientDetailsResult());
    queryClient.setQueryData(recipientBOptions.queryKey, makeRecipientDetailsResult());

    await invalidateExchangeRecipientDetailsQuery(
      queryClient,
      {
        state: "connected",
        tenantId: "tenant-a",
        connectionId: "exchange-a",
        userPrincipalName: "admin@example.com",
      },
      "exchange:objectId:mailbox:1",
    );

    expect(queryClient.getQueryState(recipientAOptions.queryKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(recipientBOptions.queryKey)?.isInvalidated).toBe(false);
  });

  it("removes only the targeted exchange recipient details query from cache", () => {
    const queryClient = new QueryClient();

    const recipientAOptions = getExchangeRecipientDetailsQueryOptions(
      "connected:tenant-a:exchange-a:admin@example.com",
      "exchange:objectId:mailbox:1",
      true,
    );
    const recipientBOptions = getExchangeRecipientDetailsQueryOptions(
      "connected:tenant-a:exchange-a:admin@example.com",
      "exchange:objectId:mailbox:2",
      true,
    );

    queryClient.setQueryData(recipientAOptions.queryKey, makeRecipientDetailsResult());
    queryClient.setQueryData(recipientBOptions.queryKey, makeRecipientDetailsResult());

    removeExchangeRecipientDetailsQuery(queryClient, {
      state: "connected",
      tenantId: "tenant-a",
      connectionId: "exchange-a",
      userPrincipalName: "admin@example.com",
    }, "exchange:objectId:mailbox:1");

    expect(queryClient.getQueryData(recipientAOptions.queryKey)).toBeUndefined();
    expect(queryClient.getQueryData(recipientBOptions.queryKey)).toEqual(makeRecipientDetailsResult());
  });
});
