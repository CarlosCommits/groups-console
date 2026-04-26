import { QueryClient } from "@tanstack/react-query";
import type * as ReactQuery from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/renderer/lib/query-keys";
import type {
  GroupMemberSelectionRef,
  GroupMemberWriteRef,
  GroupsGetMembershipsResult,
} from "@/shared/contracts/exchange";

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
  getGroupMembershipsQueryOptions,
  invalidateGroupMembershipsQueriesForMembers,
  useGroupMembershipsQuery,
} from "./use-group-memberships";

function makeMembershipsResult(
  overrides: Partial<GroupsGetMembershipsResult> = {},
): GroupsGetMembershipsResult {
  return {
    member: {
      exchangeIdentity: "jane@example.com",
      objectId: "recipient-1",
      primaryEmail: "jane@example.com",
    },
    items: [
      {
        objectId: "group-1",
        exchangeIdentity: "finance-group",
        displayName: "Finance Distribution",
        alias: "finance",
        primaryEmail: "finance@example.com",
        groupKind: "distributionList",
        managedByDisplayNames: ["Owner One"],
        whenChangedUtc: "2026-04-01T12:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

function makeCommandFailure() {
  const err = new Error("Exchange memberships bridge timed out") as Error & {
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
  err.code = "exchange_memberships_timeout";
  err.retryable = true;
  err.details = "Group memberships request timed out.";
  err.classification = {
    category: "connectionFailure",
    remediation: "reconnect",
    backend: "exchange",
    operation: "groups.getMemberships",
    guidance: "Reconnect to Exchange Online.",
  };

  return err;
}

describe("useGroupMembershipsQuery", () => {
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

    const result = useGroupMembershipsQuery(
      {
        state: "disconnected",
        tenantId: null,
        connectionId: null,
        userPrincipalName: null,
      },
      {
        kind: "exchangeRecipient",
        exchangeIdentity: "jane@example.com",
        objectId: "recipient-1",
        primaryEmail: "jane@example.com",
        displayName: "Jane Example",
      },
    );

    const [options] = useQueryMock.mock.calls[0] as [
      ReturnType<typeof getGroupMembershipsQueryOptions>,
    ];

    expect(options.enabled).toBe(false);
    expect(result.groups).toEqual([]);
    expect(result.member).toBeNull();
    expect(result.error).toBeNull();
    expect(result.hasData).toBe(false);
  });

  it("configures the shared query as disabled when no member is selected", () => {
    const refetch = vi.fn(() => Promise.resolve(undefined));

    useQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      isFetching: false,
      refetch,
    });

    useGroupMembershipsQuery(
      {
        state: "connected",
        tenantId: "tenant-a",
        connectionId: "exchange-a",
        userPrincipalName: "admin@example.com",
      },
      null,
    );

    const [options] = useQueryMock.mock.calls[0] as [
      ReturnType<typeof getGroupMembershipsQueryOptions>,
    ];

    expect(options.enabled).toBe(false);
  });

  it("maps successful query data into the shared screen-facing shape", () => {
    const refetch = vi.fn(() => Promise.resolve(undefined));
    const data = makeMembershipsResult();

    useQueryMock.mockReturnValue({
      data,
      error: null,
      isLoading: false,
      isFetching: true,
      refetch,
    });

    const result = useGroupMembershipsQuery(
      {
        state: "connected",
        tenantId: "tenant-a",
        connectionId: "exchange-a",
        userPrincipalName: "admin@example.com",
      },
      {
        kind: "exchangeRecipient",
        exchangeIdentity: "jane@example.com",
        objectId: "recipient-1",
        primaryEmail: "jane@example.com",
        displayName: "Jane Example",
      },
    );

    expect(result.groups).toEqual(data.items);
    expect(result.member).toEqual(data.member);
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

    const result = useGroupMembershipsQuery(
      {
        state: "connected",
        tenantId: "tenant-a",
        connectionId: "exchange-a",
        userPrincipalName: "admin@example.com",
      },
      {
        kind: "exchangeRecipient",
        exchangeIdentity: "jane@example.com",
        objectId: "recipient-1",
        primaryEmail: "jane@example.com",
        displayName: "Jane Example",
      },
    );

    expect(result.errorPresentation).toMatchObject({
      title: "Connection Failed",
      body: "Group memberships request timed out.",
      guidance: "Reconnect to Exchange Online.",
      severity: "error",
      retryable: true,
    });
    expect(result.error).toBe("Group memberships request timed out. Reconnect to Exchange Online.");
  });
});

describe("getGroupMembershipsQueryOptions", () => {
  const getMembershipsMock = vi.fn<
    (member: GroupMemberSelectionRef) => Promise<GroupsGetMembershipsResult>
  >();

  beforeEach(() => {
    getMembershipsMock.mockReset();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        groupsConsole: {
          groups: {
            getMemberships: getMembershipsMock,
          },
        },
      },
    });
  });

  it("reuses the cached memberships list for the same connection and member", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    const result = makeMembershipsResult();
    getMembershipsMock.mockResolvedValue(result);

    const options = getGroupMembershipsQueryOptions(
      "connected:tenant-a:exchange-a:admin@example.com",
      {
        kind: "exchangeRecipient",
        exchangeIdentity: "jane@example.com",
        objectId: "recipient-1",
        primaryEmail: "jane@example.com",
        displayName: "Jane Example",
      },
      true,
    );

    await queryClient.fetchQuery(options);
    await queryClient.fetchQuery(options);

    expect(getMembershipsMock).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(options.queryKey)).toEqual(result);
  });
});

describe("invalidateGroupMembershipsQueriesForMembers", () => {
  it("invalidates only the targeted membership queries for the current Exchange connection", async () => {
    const queryClient = new QueryClient();
    const connectionIdentity = "connected:tenant-a:exchange-a:admin@example.com";
    const exchangeKey = queryKeys.exchangeGroupMembershipsList(
      connectionIdentity,
      "exchangeRecipient:jane@example.com",
    );
    const graphKey = queryKeys.exchangeGroupMembershipsList(
      connectionIdentity,
      "graphGuest:00000000-0000-0000-0000-000000000001",
    );
    const untouchedKey = queryKeys.exchangeGroupMembershipsList(
      connectionIdentity,
      "exchangeRecipient:other@example.com",
    );

    queryClient.setQueryData(exchangeKey, { items: [{ id: "group-1" }] });
    queryClient.setQueryData(graphKey, { items: [{ id: "group-2" }] });
    queryClient.setQueryData(untouchedKey, { items: [{ id: "group-3" }] });

    const members: Array<GroupMemberSelectionRef | GroupMemberWriteRef> = [
      {
        kind: "exchangeRecipient",
        exchangeIdentity: "Jane@Example.com",
        objectId: "recipient-1",
        primaryEmail: "jane@example.com",
        displayName: "Jane Example",
      },
      {
        exchangeIdentity: "guest_exchange_identity",
        objectId: "00000000-0000-0000-0000-000000000001",
        primaryEmail: "guest@example.com",
      },
    ];

    await invalidateGroupMembershipsQueriesForMembers(
      queryClient,
      {
        state: "connected",
        tenantId: "tenant-a",
        connectionId: "exchange-a",
        userPrincipalName: "admin@example.com",
      },
      members,
    );

    expect(queryClient.getQueryState(exchangeKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(graphKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(untouchedKey)?.isInvalidated).toBe(false);
  });
});
