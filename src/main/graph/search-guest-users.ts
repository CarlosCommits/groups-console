import type { GuestsSearchPayload, GuestsSearchResult } from '@/shared/contracts/guests';

import { graphSessionManager } from './graph-session-manager';

export async function searchGuestUsers(
  payload: GuestsSearchPayload,
): Promise<GuestsSearchResult> {
  return await graphSessionManager.searchGuests(payload);
}
