import { QueryClient } from "@tanstack/react-query";
import type * as ReactQuery from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GroupsGetMembersResult } from "@/shared/contracts/exchange";

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
  getGroupMembersQueryOptions,
  invalidateGroupMembersQueryForGroup,
  useGroupMembersQuery,
} from "./use-group-members";

function makeMembersResult(overrides: Partial<GroupsGetMembersResult> = {}): GroupsGetMembersResult {
  return {
    group: {
      exchangeIdentity: "group-1@example.com",
      objectId: "group-1",
      groupKind: "distributionList",
    },
    items: [
      {
        objectId: "member-1",
        exchangeIdentity: "member-1@example.com",
        displayName: "Member One",
        primaryEmail: "member-1@example.com",
        alias: "member-one",
        recipientType: "mailbox",
        recipientTypeDetails: "UserMailbox",
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
  err.details = "Exchange members request timed out.";
  err.classification = {
    category: "connectionFailure",
    remediation: "reconnect",
    backend: "exchange",
    operation: "groups.getMembers",
    guidance: "Reconnect to Exchange Online.",
  };

  return err;
}

describe("useGroupMembersQuery", () => {
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

    const result = useGroupMembersQuery(
      {
        state: "disconnected",
        tenantId: null,
        connectionId: null,
        userPrincipalName: null,
      },
      {
        exchangeIdentity: "group-1@example.com",
        objectId: "group-1",
        groupKind: "distributionList",
      },
    );

    const [options] = useQueryMock.mock.calls[0] as [
      ReturnType<typeof getGroupMembersQueryOptions>,
    ];

    expect(options.enabled).toBe(false);
    expect(result.members).toEqual([]);
    expect(result.error).toBeNull();
    expect(result.hasData).toBe(false);
  });

  it("configures the shared query as disabled when no group is selected", () => {
    const refetch = vi.fn(() => Promise.resolve(undefined));

    useQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      isFetching: false,
      refetch,
    });

    useGroupMembersQuery(
      {
        state: "connected",
        tenantId: "tenant-a",
        connectionId: "exchange-a",
        userPrincipalName: "admin@example.com",
      },
      null,
    );

    const [options] = useQueryMock.mock.calls[0] as [
      ReturnType<typeof getGroupMembersQueryOptions>,
    ];

    expect(options.enabled).toBe(false);
  });

  it("maps successful query data into the shared screen-facing shape", () => {
    const refetch = vi.fn(() => Promise.resolve(undefined));
    const data = makeMembersResult();

    useQueryMock.mockReturnValue({
      data,
      error: null,
      isLoading: false,
      isFetching: true,
      refetch,
    });

    const result = useGroupMembersQuery(
      {
        state: "connected",
        tenantId: "tenant-a",
        connectionId: "exchange-a",
        userPrincipalName: "admin@example.com",
      },
      {
        exchangeIdentity: "group-1@example.com",
        objectId: "group-1",
        groupKind: "distributionList",
      },
    );

    expect(result.members).toEqual(data.items);
    expect(result.isLoading).toBe(false);
    expect(result.isFetching).toBe(true);
    expect(result.error).toBeNull();
    expect(result.hasData).toBe(true);
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

    const result = useGroupMembersQuery(
      {
        state: "connected",
        tenantId: "tenant-a",
        connectionId: "exchange-a",
        userPrincipalName: "admin@example.com",
      },
      {
        exchangeIdentity: "group-1@example.com",
        objectId: "group-1",
        groupKind: "distributionList",
      },
    );

    expect(result.errorPresentation).toMatchObject({
      title: "Connection Failed",
      body: "Exchange members request timed out.",
      guidance: "Reconnect to Exchange Online.",
      severity: "error",
      retryable: true,
    });
    expect(result.error).toBe("Exchange members request timed out. Reconnect to Exchange Online.");
  });
});

describe("getGroupMembersQueryOptions", () => {
  const getMembersMock = vi.fn<() => Promise<GroupsGetMembersResult>>();

  beforeEach(() => {
    getMembersMock.mockReset();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        radApp: {
          groups: {
            getMembers: getMembersMock,
          },
        },
      },
    });
  });

  it("reuses the cached members list for the same connection and group", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    const result = makeMembersResult();
    getMembersMock.mockResolvedValue(result);

    const options = getGroupMembersQueryOptions(
      "connected:tenant-a:exchange-a:admin@example.com",
      {
        exchangeIdentity: "group-1@example.com",
        objectId: "group-1",
        groupKind: "distributionList",
      },
      true,
    );

    await queryClient.fetchQuery(options);
    await queryClient.fetchQuery(options);

    expect(getMembersMock).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(options.queryKey)).toEqual(result);
  });

  it("isolates cached members by selected group identity", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    const groupOneResult = makeMembersResult();
    const groupTwoResult = makeMembersResult({
      group: {
        exchangeIdentity: "group-2@example.com",
        objectId: "group-2",
        groupKind: "distributionList",
      },
      items: [],
    });

    getMembersMock.mockResolvedValueOnce(groupOneResult).mockResolvedValueOnce(groupTwoResult);

    const groupOneOptions = getGroupMembersQueryOptions(
      "connected:tenant-a:exchange-a:admin@example.com",
      {
        exchangeIdentity: "group-1@example.com",
        objectId: "group-1",
        groupKind: "distributionList",
      },
      true,
    );
    const groupTwoOptions = getGroupMembersQueryOptions(
      "connected:tenant-a:exchange-a:admin@example.com",
      {
        exchangeIdentity: "group-2@example.com",
        objectId: "group-2",
        groupKind: "distributionList",
      },
      true,
    );

    await queryClient.fetchQuery(groupOneOptions);
    await queryClient.fetchQuery(groupTwoOptions);

    expect(getMembersMock).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryData(groupOneOptions.queryKey)).toEqual(groupOneResult);
    expect(queryClient.getQueryData(groupTwoOptions.queryKey)).toEqual(groupTwoResult);
  });

  it("invalidates only the current selected group members scope", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    const groupOneOptions = getGroupMembersQueryOptions(
      "connected:tenant-a:exchange-a:admin@example.com",
      {
        exchangeIdentity: "group-1@example.com",
        objectId: "group-1",
        groupKind: "distributionList",
      },
      true,
    );
    const groupTwoOptions = getGroupMembersQueryOptions(
      "connected:tenant-a:exchange-a:admin@example.com",
      {
        exchangeIdentity: "group-2@example.com",
        objectId: "group-2",
        groupKind: "distributionList",
      },
      true,
    );

    queryClient.setQueryData(groupOneOptions.queryKey, makeMembersResult());
    queryClient.setQueryData(groupTwoOptions.queryKey, makeMembersResult({ items: [] }));

    await invalidateGroupMembersQueryForGroup(
      queryClient,
      {
        state: "connected",
        tenantId: "tenant-a",
        connectionId: "exchange-a",
        userPrincipalName: "admin@example.com",
      },
      {
        exchangeIdentity: "group-1@example.com",
        objectId: "group-1",
        groupKind: "distributionList",
      },
    );

    expect(queryClient.getQueryState(groupOneOptions.queryKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(groupTwoOptions.queryKey)?.isInvalidated).toBe(false);
  });
});
