import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

import {
  hasInventoryChangingAddOutcome,
  hasInventoryChangingRemoveOutcome,
  hasMembersRefreshableAddOutcome,
  hasMembersRefreshableRemoveOutcome,
} from "@/renderer/components/console/group-members-mutation-outcome";
import { invalidateExchangeGroupsQueryForConnection } from "@/renderer/hooks/use-exchange-groups";
import { invalidateGroupMembersQueryForGroup } from "@/renderer/hooks/use-group-members";
import type {
  ExchangeConnectionStatus,
  ExchangeGroupRef,
  GroupMemberSelectionRef,
  GroupMemberWriteRef,
} from "@/shared/contracts/exchange";

type ExchangeConnectionIdentityInput = Pick<
  ExchangeConnectionStatus,
  "state" | "tenantId" | "connectionId" | "userPrincipalName"
>;

export interface AddGroupMembersMutationVariables {
  groupRef: ExchangeGroupRef;
  memberRefs: GroupMemberSelectionRef[];
}

export interface RemoveGroupMembersMutationVariables {
  groupRef: ExchangeGroupRef;
  memberRefs: GroupMemberWriteRef[];
}

export function getAddGroupMembersMutationOptions(
  queryClient: QueryClient,
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
) {
  return {
    mutationFn: async ({ groupRef, memberRefs }: AddGroupMembersMutationVariables) =>
      window.radApp.groups.addMembers(groupRef, memberRefs),
    onSuccess: async (
      result: Awaited<ReturnType<typeof window.radApp.groups.addMembers>>,
      variables: AddGroupMembersMutationVariables,
    ) => {
      if (hasInventoryChangingAddOutcome(result)) {
        await invalidateExchangeGroupsQueryForConnection(queryClient, exchangeConnection);
      }

      if (hasMembersRefreshableAddOutcome(result)) {
        await invalidateGroupMembersQueryForGroup(queryClient, exchangeConnection, variables.groupRef);
      }
    },
  };
}

export function useAddGroupMembersMutation(
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
) {
  const queryClient = useQueryClient();

  return useMutation(getAddGroupMembersMutationOptions(queryClient, exchangeConnection));
}

export function getRemoveGroupMembersMutationOptions(
  queryClient: QueryClient,
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
) {
  return {
    mutationFn: async ({ groupRef, memberRefs }: RemoveGroupMembersMutationVariables) =>
      window.radApp.groups.removeMembers(groupRef, memberRefs),
    onSuccess: async (
      result: Awaited<ReturnType<typeof window.radApp.groups.removeMembers>>,
      variables: RemoveGroupMembersMutationVariables,
    ) => {
      if (hasInventoryChangingRemoveOutcome(result)) {
        await invalidateExchangeGroupsQueryForConnection(queryClient, exchangeConnection);
      }

      if (hasMembersRefreshableRemoveOutcome(result)) {
        await invalidateGroupMembersQueryForGroup(queryClient, exchangeConnection, variables.groupRef);
      }
    },
  };
}

export function useRemoveGroupMembersMutation(
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
) {
  const queryClient = useQueryClient();

  return useMutation(getRemoveGroupMembersMutationOptions(queryClient, exchangeConnection));
}
