import type {
  GroupsRemoveMembersPayload,
  GroupsRemoveMembersResult,
} from '@/shared/contracts/exchange';

import { exchangeSessionManager } from './exchange-session-manager';

export async function removeGroupMembers(
  payload: GroupsRemoveMembersPayload,
): Promise<GroupsRemoveMembersResult> {
  return await exchangeSessionManager.removeMembers(payload);
}
