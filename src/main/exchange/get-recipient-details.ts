import type { ExchangeRecipientGetDetailsResult } from '@/shared/contracts/exchange';

import { exchangeSessionManager } from './exchange-session-manager';

export async function getExchangeRecipientDetails(
  exchangeIdentity: string,
): Promise<ExchangeRecipientGetDetailsResult> {
  return await exchangeSessionManager.getRecipientDetails(exchangeIdentity);
}
