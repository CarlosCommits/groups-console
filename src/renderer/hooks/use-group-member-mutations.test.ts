import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/renderer/lib/query-keys";
import type {
  ExchangeConnectionStatus,
  ExchangeGroupRef,
  GroupMemberSelectionRef,
  GroupMemberWriteRef,
  GroupsAddMembersResult,
  GroupsRemoveMembersResult,
} from "@/shared/contracts/exchange";

import {
  getAddGroupMembersMutationOptions,
  getRemoveGroupMembersMutationOptions,
} from "./use-group-member-mutations";

const addMembersMock = vi.fn<
  (group: ExchangeGroupRef, members: GroupMemberSelectionRef[]) => Promise<GroupsAddMembersResult>
>();
const removeMembersMock = vi.fn<
  (group: ExchangeGroupRef, members: GroupMemberWriteRef[]) => Promise<GroupsRemoveMembersResult>
>();

const exchangeConnection: Pick<
  ExchangeConnectionStatus,
  "state" | "tenantId" | "connectionId" | "userPrincipalName"
> = {
  state: "connected",
  tenantId: "tenant-a",
  connectionId: "exchange-a",
  userPrincipalName: "admin@example.com",
};

const groupRef: ExchangeGroupRef = {
  exchangeIdentity: "group-1@example.com",
  objectId: "group-1",
  groupKind: "distributionList",
};

function makeAddResult(
  status: GroupsAddMembersResult["items"][number]["status"],
): GroupsAddMembersResult {
  return {
    group: groupRef,
    summary: {
      requested: 1,
      added: status === "added" ? 1 : 0,
      alreadyMember: status === "alreadyMember" ? 1 : 0,
      invalid: status === "invalid" ? 1 : 0,
      verificationFailed: status === "verificationFailed" ? 1 : 0,
      failed: status === "failed" ? 1 : 0,
    },
    items: [
      {
        member: {
          exchangeIdentity: "member-1@example.com",
          objectId: "member-1",
          primaryEmail: "member-1@example.com",
        },
        status,
        detail: status,
      },
    ],
    verification: {
      attempted: true,
      verifiedAdded: status === "added" ? 1 : 0,
      detail: "verification",
    },
  };
}

function makeRemoveResult(
  status: GroupsRemoveMembersResult["items"][number]["status"],
): GroupsRemoveMembersResult {
  return {
    group: groupRef,
    summary: {
      requested: 1,
      removed: status === "removed" ? 1 : 0,
      notMember: status === "notMember" ? 1 : 0,
      invalid: status === "invalid" ? 1 : 0,
      verificationFailed: status === "verificationFailed" ? 1 : 0,
      failed: status === "failed" ? 1 : 0,
    },
    items: [
      {
        member: {
          exchangeIdentity: "member-1@example.com",
          objectId: "member-1",
          primaryEmail: "member-1@example.com",
        },
        status,
        detail: status,
      },
    ],
    verification: {
      attempted: true,
      verifiedRemoved: status === "removed" ? 1 : 0,
      detail: "verification",
    },
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
      },
    },
  });
}

function seedGroupQueries(queryClient: QueryClient) {
  const groupsKey = queryKeys.exchangeGroupsList("connected:tenant-a:exchange-a:admin@example.com");
  const selectedGroupMembersKey = queryKeys.exchangeGroupMembersList(
    "connected:tenant-a:exchange-a:admin@example.com",
    groupRef.exchangeIdentity,
  );
  const otherGroupMembersKey = queryKeys.exchangeGroupMembersList(
    "connected:tenant-a:exchange-a:admin@example.com",
    "other-group@example.com",
  );
  const exchangeMembershipsKey = queryKeys.exchangeGroupMembershipsList(
    "connected:tenant-a:exchange-a:admin@example.com",
    "exchangeRecipient:member-1@example.com",
  );
  const graphMembershipsKey = queryKeys.exchangeGroupMembershipsList(
    "connected:tenant-a:exchange-a:admin@example.com",
    "graphGuest:member-1",
  );
  const otherMembershipsKey = queryKeys.exchangeGroupMembershipsList(
    "connected:tenant-a:exchange-a:admin@example.com",
    "exchangeRecipient:member-2@example.com",
  );

  queryClient.setQueryData(groupsKey, { items: [{ id: "group-1" }] });
  queryClient.setQueryData(selectedGroupMembersKey, { items: [{ id: "member-1" }] });
  queryClient.setQueryData(otherGroupMembersKey, { items: [{ id: "member-2" }] });
  queryClient.setQueryData(exchangeMembershipsKey, { items: [{ id: "group-1" }] });
  queryClient.setQueryData(graphMembershipsKey, { items: [{ id: "group-2" }] });
  queryClient.setQueryData(otherMembershipsKey, { items: [{ id: "group-3" }] });

  return {
    groupsKey,
    selectedGroupMembersKey,
    otherGroupMembersKey,
    exchangeMembershipsKey,
    graphMembershipsKey,
    otherMembershipsKey,
  };
}

describe("group member mutation options", () => {
  beforeEach(() => {
    addMembersMock.mockReset();
    removeMembersMock.mockReset();

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        groupsConsole: {
          groups: {
            addMembers: addMembersMock,
            removeMembers: removeMembersMock,
          },
        },
      },
    });
  });

  it("delegates add-member writes through the shared mutation layer", async () => {
    const queryClient = createQueryClient();
    const memberRefs: GroupMemberSelectionRef[] = [
      {
        kind: "exchangeRecipient",
        exchangeIdentity: "member-1@example.com",
        objectId: "member-1",
        primaryEmail: "member-1@example.com",
        displayName: "Member One",
      },
    ];
    const result = makeAddResult("added");
    addMembersMock.mockResolvedValue(result);

    const options = getAddGroupMembersMutationOptions(queryClient, exchangeConnection);
    const mutationResult = await options.mutationFn({ groupRef, memberRefs });

    expect(addMembersMock).toHaveBeenCalledWith(groupRef, memberRefs);
    expect(mutationResult).toEqual(result);
  });

  it("invalidates groups inventory only for added outcomes and members for refreshable add outcomes", async () => {
    const queryClient = createQueryClient();
    const {
      groupsKey,
      selectedGroupMembersKey,
      otherGroupMembersKey,
      exchangeMembershipsKey,
      graphMembershipsKey,
      otherMembershipsKey,
    } = seedGroupQueries(queryClient);
    const options = getAddGroupMembersMutationOptions(queryClient, exchangeConnection);
    const memberRefs: GroupMemberSelectionRef[] = [
      {
        kind: "exchangeRecipient",
        exchangeIdentity: "member-1@example.com",
        objectId: "member-1",
        primaryEmail: "member-1@example.com",
        displayName: "Member One",
      },
    ];

    await options.onSuccess?.(makeAddResult("alreadyMember"), { groupRef, memberRefs });

    expect(queryClient.getQueryState(groupsKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(selectedGroupMembersKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherGroupMembersKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(exchangeMembershipsKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(graphMembershipsKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(otherMembershipsKey)?.isInvalidated).toBe(false);

    queryClient.clear();
    const reseeded = seedGroupQueries(queryClient);

    await options.onSuccess?.(makeAddResult("added"), { groupRef, memberRefs });

    expect(queryClient.getQueryState(reseeded.groupsKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(reseeded.selectedGroupMembersKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(reseeded.otherGroupMembersKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(reseeded.exchangeMembershipsKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(reseeded.graphMembershipsKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(reseeded.otherMembershipsKey)?.isInvalidated).toBe(false);
  });

  it("does not invalidate group caches for failed-only add outcomes", async () => {
    const queryClient = createQueryClient();
    const { groupsKey, selectedGroupMembersKey, exchangeMembershipsKey } = seedGroupQueries(queryClient);
    const options = getAddGroupMembersMutationOptions(queryClient, exchangeConnection);

    await options.onSuccess?.(makeAddResult("failed"), { groupRef, memberRefs: [] });

    expect(queryClient.getQueryState(groupsKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(selectedGroupMembersKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(exchangeMembershipsKey)?.isInvalidated).toBe(false);
  });

  it("delegates remove-member writes through the shared mutation layer", async () => {
    const queryClient = createQueryClient();
    const memberRefs: GroupMemberWriteRef[] = [
      {
        exchangeIdentity: "member-1@example.com",
        objectId: "member-1",
        primaryEmail: "member-1@example.com",
      },
    ];
    const result = makeRemoveResult("removed");
    removeMembersMock.mockResolvedValue(result);

    const options = getRemoveGroupMembersMutationOptions(queryClient, exchangeConnection);
    const mutationResult = await options.mutationFn({ groupRef, memberRefs });

    expect(removeMembersMock).toHaveBeenCalledWith(groupRef, memberRefs);
    expect(mutationResult).toEqual(result);
  });

  it("invalidates groups inventory only for removed outcomes and members for refreshable remove outcomes", async () => {
    const queryClient = createQueryClient();
    const {
      groupsKey,
      selectedGroupMembersKey,
      otherGroupMembersKey,
      exchangeMembershipsKey,
      graphMembershipsKey,
      otherMembershipsKey,
    } = seedGroupQueries(queryClient);
    const options = getRemoveGroupMembersMutationOptions(queryClient, exchangeConnection);
    const memberRefs: GroupMemberWriteRef[] = [
      {
        exchangeIdentity: "member-1@example.com",
        objectId: "member-1",
        primaryEmail: "member-1@example.com",
      },
    ];

    await options.onSuccess?.(makeRemoveResult("notMember"), { groupRef, memberRefs });

    expect(queryClient.getQueryState(groupsKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(selectedGroupMembersKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherGroupMembersKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(exchangeMembershipsKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(graphMembershipsKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherMembershipsKey)?.isInvalidated).toBe(false);

    queryClient.clear();
    const reseeded = seedGroupQueries(queryClient);

    await options.onSuccess?.(makeRemoveResult("removed"), { groupRef, memberRefs });

    expect(queryClient.getQueryState(reseeded.groupsKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(reseeded.selectedGroupMembersKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(reseeded.otherGroupMembersKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(reseeded.exchangeMembershipsKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(reseeded.graphMembershipsKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(reseeded.otherMembershipsKey)?.isInvalidated).toBe(false);
  });

  it("does not invalidate group caches for failed-only remove outcomes", async () => {
    const queryClient = createQueryClient();
    const { groupsKey, selectedGroupMembersKey, exchangeMembershipsKey } = seedGroupQueries(queryClient);
    const options = getRemoveGroupMembersMutationOptions(queryClient, exchangeConnection);

    await options.onSuccess?.(makeRemoveResult("failed"), { groupRef, memberRefs: [] });

    expect(queryClient.getQueryState(groupsKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(selectedGroupMembersKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(exchangeMembershipsKey)?.isInvalidated).toBe(false);
  });
});
