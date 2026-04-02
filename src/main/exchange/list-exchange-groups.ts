import type {
  ExchangeListGroupsPayload,
  ExchangeListGroupsResult,
} from '@/shared/contracts/exchange';

import { exchangeSessionManager } from './exchange-session-manager';

export async function listExchangeGroups(
  payload: ExchangeListGroupsPayload,
): Promise<ExchangeListGroupsResult> {
  return await exchangeSessionManager.listGroups(payload);
}
