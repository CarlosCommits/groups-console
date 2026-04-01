import type { ExchangeConnectionStatus } from '@/shared/contracts/exchange';

import { exchangeSessionManager } from './exchange-session-manager';

export async function getExchangeConnectionStatus(): Promise<ExchangeConnectionStatus> {
  return await exchangeSessionManager.getConnectionStatus();
}
