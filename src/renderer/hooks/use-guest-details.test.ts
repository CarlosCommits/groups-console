import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GuestsGetDetailsResult } from "@/shared/contracts/guests";

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );

  return {
    ...actual,
    useQuery: useQueryMock,
  };
});

import {
  getGuestDetailsQueryOptions,
  invalidateGuestDetailsQuery,
  removeGuestDetailsQuery,
  useGuestDetailsQuery,
} from "./use-guest-details";

function makeGuestDetailsResult(): GuestsGetDetailsResult {
  return {
    guest: {
      stableKey: "graph:objectId:guest-1",
      objectId: "guest-obj-1",
      displayName: "Test Guest",
      primaryEmail: "guest@example.com",
      userPrincipalName: "guest_example#EXT#@tenant.onmicrosoft.com",
      companyName: "Guest Corp",
      externalUserState: "Accepted",
      givenName: "Test",
      surname: "Guest",
      jobTitle: "Consultant",
      department: "External",
      mobilePhone: "+1 555-0200",
      officeLocation: "Remote",
      preferredLanguage: "en-US",
      createdDateTime: "2026-01-15T10:30:00.000Z",
      accountEnabled: true,
    },
  };
}

function makeCommandFailure() {
  const err = new Error("Guest details bridge timed out") as Error & {
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
  err.code = "guests_timeout";
  err.retryable = true;
  err.details = "Guest details request timed out.";
  err.classification = {
    category: "connectionFailure",
    remediation: "reconnect",
    backend: "graph",
    operation: "guests.getDetails",
    guidance: "Reconnect to Microsoft Graph.",
  };

  return err;
}

describe("useGuestDetailsQuery", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
  });

  it("configures the shared query as disabled when Exchange is disconnected", () => {
    const refetch = vi.fn(async () => undefined);

    useQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      isFetching: false,
      refetch,
    });

    const result = useGuestDetailsQuery(
      {
        state: "disconnected",
        tenantId: null,
        configuredTenantId: null,
        accountUsername: null,
      },
      "graph:objectId:guest-1",
    );

    const [options] = useQueryMock.mock.calls[0] as [
      ReturnType<typeof getGuestDetailsQueryOptions>,
    ];

    expect(options.enabled).toBe(false);
    expect(result.guest).toBeNull();
    expect(result.error).toBeNull();
  });

  it("configures the shared query as disabled when no stable key is provided", () => {
    const refetch = vi.fn(async () => undefined);

    useQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      isFetching: false,
      refetch,
    });

    useGuestDetailsQuery(
      {
        state: "connected",
        tenantId: "tenant-a",
        configuredTenantId: "tenant-a",
        accountUsername: "graph-admin@example.com",
      },
      undefined,
    );

    const [options] = useQueryMock.mock.calls[0] as [
      ReturnType<typeof getGuestDetailsQueryOptions>,
    ];

    expect(options.enabled).toBe(false);
  });

  it("does not allow an explicit enabled flag to bypass a disconnected Graph session", () => {
    const refetch = vi.fn(async () => undefined);

    useQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      isFetching: false,
      refetch,
    });

    useGuestDetailsQuery(
      {
        state: "disconnected",
        tenantId: null,
        configuredTenantId: null,
        accountUsername: null,
      },
      "graph:objectId:guest-1",
      true,
    );

    const [options] = useQueryMock.mock.calls[0] as [
      ReturnType<typeof getGuestDetailsQueryOptions>,
    ];

    expect(options.enabled).toBe(false);
  });

  it("maps successful query data into the shared screen-facing shape", () => {
    const refetch = vi.fn(async () => undefined);
    const data = makeGuestDetailsResult();

    useQueryMock.mockReturnValue({
      data,
      error: null,
      isLoading: false,
      isFetching: true,
      refetch,
    });

    const result = useGuestDetailsQuery(
      {
        state: "connected",
        tenantId: "tenant-a",
        configuredTenantId: "tenant-a",
        accountUsername: "graph-admin@example.com",
      },
      "graph:objectId:guest-1",
    );

    expect(result.guest).toEqual(data.guest);
    expect(result.isLoading).toBe(false);
    expect(result.isFetching).toBe(true);
    expect(result.error).toBeNull();
    expect(result.errorPresentation).toBeNull();
  });

  it("formats query failures with the shared command failure presenter", () => {
    const refetch = vi.fn(async () => undefined);

    useQueryMock.mockReturnValue({
      data: undefined,
      error: makeCommandFailure(),
      isLoading: false,
      isFetching: false,
      refetch,
    });

    const result = useGuestDetailsQuery(
      {
        state: "connected",
        tenantId: "tenant-a",
        configuredTenantId: "tenant-a",
        accountUsername: "graph-admin@example.com",
      },
      "graph:objectId:guest-1",
    );

    expect(result.errorPresentation).toMatchObject({
      title: "Connection Failed",
      body: "Guest details request timed out.",
      guidance: "Reconnect to Microsoft Graph.",
      severity: "error",
      retryable: true,
    });
    expect(result.error).toBe("Guest details request timed out. Reconnect to Microsoft Graph.");
  });
});

describe("getGuestDetailsQueryOptions", () => {
  const getDetailsMock = vi.fn<() => Promise<GuestsGetDetailsResult>>();

  beforeEach(() => {
    getDetailsMock.mockReset();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        radApp: {
          guests: {
            getDetails: getDetailsMock,
          },
        },
      },
    });
  });

  it("reuses the cached guest details for the same connection and stable key", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    const result = makeGuestDetailsResult();
    getDetailsMock.mockResolvedValue(result);

    const options = getGuestDetailsQueryOptions(
      "connected:tenant-a:graph-admin@example.com",
      "graph:objectId:guest-1",
      true,
    );

    await queryClient.fetchQuery(options);
    await queryClient.fetchQuery(options);

    expect(getDetailsMock).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(options.queryKey)).toEqual(result);
  });

  it("isolates cached guest details by connection identity", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    const tenantAResult = makeGuestDetailsResult();
    const tenantBResult = makeGuestDetailsResult();

    getDetailsMock
      .mockResolvedValueOnce(tenantAResult)
      .mockResolvedValueOnce(tenantBResult);

    const tenantAOptions = getGuestDetailsQueryOptions(
      "connected:tenant-a:graph-admin@example.com",
      "graph:objectId:guest-1",
      true,
    );
    const tenantBOptions = getGuestDetailsQueryOptions(
      "connected:tenant-b:graph-admin@example.com",
      "graph:objectId:guest-1",
      true,
    );

    await queryClient.fetchQuery(tenantAOptions);
    await queryClient.fetchQuery(tenantBOptions);

    expect(getDetailsMock).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryData(tenantAOptions.queryKey)).toEqual(tenantAResult);
    expect(queryClient.getQueryData(tenantBOptions.queryKey)).toEqual(tenantBResult);
  });

  it("invalidates only the current guest details scope", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    const guestAOptions = getGuestDetailsQueryOptions(
      "connected:tenant-a:graph-admin@example.com",
      "graph:objectId:guest-1",
      true,
    );
    const guestBOptions = getGuestDetailsQueryOptions(
      "connected:tenant-a:graph-admin@example.com",
      "graph:objectId:guest-2",
      true,
    );

    queryClient.setQueryData(guestAOptions.queryKey, makeGuestDetailsResult());
    queryClient.setQueryData(guestBOptions.queryKey, makeGuestDetailsResult());

    await invalidateGuestDetailsQuery(queryClient, {
      state: "connected",
      tenantId: "tenant-a",
      configuredTenantId: "tenant-a",
      accountUsername: "graph-admin@example.com",
    }, "graph:objectId:guest-1");

    expect(queryClient.getQueryState(guestAOptions.queryKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(guestBOptions.queryKey)?.isInvalidated).toBe(false);
  });

  it("removes only the targeted guest details query from cache", () => {
    const queryClient = new QueryClient();

    const guestAOptions = getGuestDetailsQueryOptions(
      "connected:tenant-a:graph-admin@example.com",
      "graph:objectId:guest-1",
      true,
    );
    const guestBOptions = getGuestDetailsQueryOptions(
      "connected:tenant-a:graph-admin@example.com",
      "graph:objectId:guest-2",
      true,
    );

    queryClient.setQueryData(guestAOptions.queryKey, makeGuestDetailsResult());
    queryClient.setQueryData(guestBOptions.queryKey, makeGuestDetailsResult());

    removeGuestDetailsQuery(queryClient, {
      state: "connected",
      tenantId: "tenant-a",
      configuredTenantId: "tenant-a",
      accountUsername: "graph-admin@example.com",
    }, "graph:objectId:guest-1");

    expect(queryClient.getQueryData(guestAOptions.queryKey)).toBeUndefined();
    expect(queryClient.getQueryData(guestBOptions.queryKey)).toEqual(makeGuestDetailsResult());
  });
});
