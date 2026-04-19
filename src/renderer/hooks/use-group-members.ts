import { QueryClient, queryOptions, useQuery } from "@tanstack/react-query";

import {
  formatPresentedCommandFailure,
  presentCommandFailure,
  type ClassifiedFailurePresentation,
} from "@/renderer/components/console/command-failure-presenter";
import { getExchangeConnectionIdentity, queryKeys } from "@/renderer/lib/query-keys";
import type {
  ExchangeConnectionStatus,
  ExchangeGroupListItem,
  ExchangeGroupRef,
  GroupMemberListItem,
  GroupsGetMembersResult,
} from "@/shared/contracts/exchange";

const MEMBERS_ERROR_TITLE = "Members Error";
const MEMBERS_ERROR_BODY = "Failed to load members.";

type ExchangeConnectionIdentityInput = Pick<
  ExchangeConnectionStatus,
  "state" | "tenantId" | "connectionId" | "userPrincipalName"
>;

type SelectedGroupInput = Pick<ExchangeGroupListItem, "exchangeIdentity" | "objectId" | "groupKind">;

function groupRefFromSelectedGroup(group: SelectedGroupInput): ExchangeGroupRef {
  return {
    exchangeIdentity: group.exchangeIdentity,
    objectId: group.objectId,
    groupKind: group.groupKind,
  };
}

export function getGroupMembersQueryOptions(
  connectionIdentity: string | null | undefined,
  selectedGroup: SelectedGroupInput | null | undefined,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: queryKeys.exchangeGroupMembersList(connectionIdentity, selectedGroup?.exchangeIdentity ?? "none"),
    enabled,
    queryFn: async (): Promise<GroupsGetMembersResult> =>
      window.radApp.groups.getMembers(groupRefFromSelectedGroup(selectedGroup!)),
  });
}

export async function invalidateGroupMembersQueryForGroup(
  queryClient: QueryClient,
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
  selectedGroup?: SelectedGroupInput | null,
) {
  if (!selectedGroup) {
    return;
  }

  const connectionIdentity = getExchangeConnectionIdentity(exchangeConnection);

  await queryClient.invalidateQueries({
    queryKey: queryKeys.exchangeGroupMembersList(connectionIdentity, selectedGroup.exchangeIdentity),
  });
}

export interface UseGroupMembersQueryResult {
  members: GroupMemberListItem[];
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  errorPresentation: ClassifiedFailurePresentation | null;
  hasData: boolean;
  refetch: () => Promise<unknown>;
}

export function useGroupMembersQuery(
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
  selectedGroup?: SelectedGroupInput | null,
): UseGroupMembersQueryResult {
  const exchangeConnected = exchangeConnection?.state === "connected";
  const connectionIdentity = getExchangeConnectionIdentity(exchangeConnection);

  const query = useQuery(
    getGroupMembersQueryOptions(connectionIdentity, selectedGroup, exchangeConnected && selectedGroup !== null),
  );

  const errorPresentation = query.error
    ? presentCommandFailure(query.error, MEMBERS_ERROR_TITLE, MEMBERS_ERROR_BODY)
    : null;

  return {
    members: query.data?.items ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: errorPresentation ? formatPresentedCommandFailure(errorPresentation) : null,
    errorPresentation,
    hasData: query.data !== undefined,
    refetch: () => query.refetch(),
  };
}
