import type {
  ExchangeGroupRef,
  GroupsGetMembersPayload,
  GroupsGetMembersResult,
} from '@/shared/contracts/exchange';

import { exchangeSessionManager } from './exchange-session-manager';

export async function getGroupMembers(
  payload: GroupsGetMembersPayload,
): Promise<GroupsGetMembersResult> {
  return await exchangeSessionManager.getGroupMembers(payload);
}

export function createGroupMembersPayload(group: ExchangeGroupRef): GroupsGetMembersPayload {
  return { group };
}
