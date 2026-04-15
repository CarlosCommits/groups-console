import type { GuestsGetDetailsResult } from '@/shared/contracts/guests';

import { graphSessionManager } from './graph-session-manager';

export async function getGuestDetails(
  guestUserId: string,
): Promise<GuestsGetDetailsResult> {
  return await graphSessionManager.getGuestDetails(guestUserId);
}
