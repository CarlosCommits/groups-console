import type {
  GroupsAddMembersPayload,
  GroupsAddMembersResult,
} from '@/shared/contracts/exchange';

import { exchangeSessionManager } from './exchange-session-manager';

export async function addGroupMembers(
  payload: GroupsAddMembersPayload,
): Promise<GroupsAddMembersResult> {
  return await exchangeSessionManager.addMembers(payload);
}
