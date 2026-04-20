import type {
  GroupsGetMembershipsPayload,
  GroupsGetMembershipsResult,
  ResolvedGroupsGetMembershipsPayload,
} from '@/shared/contracts/exchange';

import { resolveRecipientForMembership } from '@/main/recipients/resolve-recipient-for-membership';

import { exchangeSessionManager } from './exchange-session-manager';

export async function getGroupMemberships(
  payload: GroupsGetMembershipsPayload,
): Promise<GroupsGetMembershipsResult> {
  const resolution = await resolveRecipientForMembership(payload.member);

  if (resolution.kind !== 'exchangeDirect') {
    throw new Error(resolution.reason);
  }

  return await exchangeSessionManager.getGroupMemberships({
    member: resolution.member,
  } satisfies ResolvedGroupsGetMembershipsPayload);
}
