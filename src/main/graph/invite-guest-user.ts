import type { GuestsInvitePayload, GuestsInviteResult } from '@/shared/contracts/guests';

import { checkRecipientConflicts } from '@/main/recipients/recipient-conflict-service';

import { graphSessionManager } from './graph-session-manager';

export async function inviteGuestUser(
  payload: GuestsInvitePayload,
): Promise<GuestsInviteResult> {
  const conflict = await checkRecipientConflicts('guests.invite', payload.email);

  if (conflict) {
    if (conflict.action !== 'guests.invite') {
      throw new Error('Guest invite conflict preflight returned an unexpected action.');
    }

    return {
      outcome: 'blockedConflict',
      conflict,
    };
  }

  return await graphSessionManager.inviteGuest(payload);
}
