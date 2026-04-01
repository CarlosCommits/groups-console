import type { ExchangeConnectionStatus } from '@/shared/contracts/exchange';

import { exchangeSessionManager } from './exchange-session-manager';

export async function disconnectExchange(): Promise<ExchangeConnectionStatus> {
  return await exchangeSessionManager.disconnect();
}
