import { type QueryClient, queryOptions, useQuery } from "@tanstack/react-query";

import {
  formatPresentedCommandFailure,
  presentCommandFailure,
  type ClassifiedFailurePresentation,
} from "@/renderer/components/console/command-failure-presenter";
import { getExchangeConnectionIdentity, queryKeys } from "@/renderer/lib/query-keys";
import type {
  ExchangeConnectionStatus,
  ExchangeGroupListItem,
  GroupMemberSelectionRef,
  GroupMemberWriteRef,
  GroupsGetMembershipsResult,
} from "@/shared/contracts/exchange";

const GROUP_MEMBERSHIPS_ERROR_TITLE = "Memberships Error";
const GROUP_MEMBERSHIPS_ERROR_BODY = "Failed to load group memberships.";

type ExchangeConnectionIdentityInput = Pick<
  ExchangeConnectionStatus,
  "state" | "tenantId" | "connectionId" | "userPrincipalName"
>;

type GroupMembershipQueryTarget = GroupMemberSelectionRef | GroupMemberWriteRef;

function getGroupMembershipQueryIdentity(member: GroupMemberSelectionRef): string {
  return member.kind === "exchangeRecipient"
    ? `exchangeRecipient:${member.exchangeIdentity.toLowerCase()}`
    : `graphGuest:${member.objectId.toLowerCase()}`;
}

function getGroupMembershipInvalidationIdentities(
  member: GroupMembershipQueryTarget,
): string[] {
  if ("kind" in member) {
    return [getGroupMembershipQueryIdentity(member)];
  }

  const identities = [`exchangeRecipient:${member.exchangeIdentity.toLowerCase()}`];

  if (member.objectId) {
    identities.push(`graphGuest:${member.objectId.toLowerCase()}`);
  }

  return identities;
}

export function getGroupMembershipsQueryOptions(
  connectionIdentity: string | null | undefined,
  member: GroupMemberSelectionRef | null | undefined,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: queryKeys.exchangeGroupMembershipsList(
      connectionIdentity,
      member ? getGroupMembershipQueryIdentity(member) : "none",
    ),
    enabled,
    queryFn: async (): Promise<GroupsGetMembershipsResult> =>
      window.radApp.groups.getMemberships(member!),
  });
}

export async function invalidateGroupMembershipsQueriesForMembers(
  queryClient: QueryClient,
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
  members?: ReadonlyArray<GroupMembershipQueryTarget>,
) {
  if (!members || members.length === 0) {
    return;
  }

  const connectionIdentity = getExchangeConnectionIdentity(exchangeConnection);
  const identities = new Set(
    members.flatMap((member) => getGroupMembershipInvalidationIdentities(member)),
  );

  await Promise.all(
    [...identities].map(async (identity) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.exchangeGroupMembershipsList(connectionIdentity, identity),
      });
    }),
  );
}

export interface UseGroupMembershipsQueryResult {
  member: GroupMemberWriteRef | null;
  groups: ExchangeGroupListItem[];
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  errorPresentation: ClassifiedFailurePresentation | null;
  hasData: boolean;
  refetch: () => Promise<unknown>;
}

export function useGroupMembershipsQuery(
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
  member?: GroupMemberSelectionRef | null,
  enabled?: boolean,
): UseGroupMembershipsQueryResult {
  const exchangeConnected = exchangeConnection?.state === "connected";
  const connectionIdentity = getExchangeConnectionIdentity(exchangeConnection);
  const shouldEnable = (enabled ?? true) && exchangeConnected && !!member;

  const query = useQuery(
    getGroupMembershipsQueryOptions(connectionIdentity, member, shouldEnable),
  );

  const errorPresentation = query.error
    ? presentCommandFailure(
        query.error,
        GROUP_MEMBERSHIPS_ERROR_TITLE,
        GROUP_MEMBERSHIPS_ERROR_BODY,
      )
    : null;

  return {
    member: query.data?.member ?? null,
    groups: query.data?.items ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: errorPresentation ? formatPresentedCommandFailure(errorPresentation) : null,
    errorPresentation,
    hasData: query.data !== undefined,
    refetch: () => query.refetch(),
  };
}
