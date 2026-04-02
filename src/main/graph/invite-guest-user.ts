import type { GuestsInvitePayload, GuestsInviteResult } from '@/shared/contracts/guests';

import { graphSessionManager } from './graph-session-manager';

export async function inviteGuestUser(
  payload: GuestsInvitePayload,
): Promise<GuestsInviteResult> {
  return await graphSessionManager.inviteGuest(payload);
}
