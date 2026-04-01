import {
  type ExchangeConnectPayload,
  type ExchangeConnectionStatus,
} from '@/shared/contracts/exchange';

import { getExchangeCapabilities } from './get-exchange-capabilities';
import { exchangeSessionManager } from './exchange-session-manager';

export async function connectExchange(
  payload: ExchangeConnectPayload,
): Promise<ExchangeConnectionStatus> {
  const capabilities = await getExchangeCapabilities();

  if (!capabilities.exchangeModule.installed) {
    return {
      state: 'error',
      detail: 'ExchangeOnlineManagement is not installed for the selected runtime.',
      runtime: capabilities.runtime,
      userPrincipalName: null,
      connectionId: null,
      tenantId: null,
      tokenStatus: null,
      tokenExpiryTimeUtc: null,
      connectedAtUtc: null,
    };
  }

  if (!capabilities.exchangeModule.importable) {
    return {
      state: 'error',
      detail: capabilities.exchangeModule.importError ?? 'ExchangeOnlineManagement could not be imported.',
      runtime: capabilities.runtime,
      userPrincipalName: null,
      connectionId: null,
      tenantId: null,
      tokenStatus: null,
      tokenExpiryTimeUtc: null,
      connectedAtUtc: null,
    };
  }

  return await exchangeSessionManager.connect(payload);
}
