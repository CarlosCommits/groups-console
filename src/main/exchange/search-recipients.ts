import type {
  RecipientsSearchPayload,
  RecipientsSearchResult,
} from '@/shared/contracts/recipients';

import { exchangeSessionManager } from './exchange-session-manager';

export async function searchExchangeRecipients(
  payload: RecipientsSearchPayload,
): Promise<RecipientsSearchResult> {
  return await exchangeSessionManager.searchRecipients(payload);
}
