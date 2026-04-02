import type {
  GuestsUpdateCompanyPayload,
  GuestsUpdateCompanyResult,
} from '@/shared/contracts/guests';

import { graphSessionManager } from './graph-session-manager';

export async function updateGuestCompany(
  payload: GuestsUpdateCompanyPayload,
): Promise<GuestsUpdateCompanyResult> {
  return await graphSessionManager.updateGuestCompany(payload);
}
