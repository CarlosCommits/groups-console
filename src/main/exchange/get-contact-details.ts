import type { ContactsGetDetailsResult } from '@/shared/contracts/contacts';

import { exchangeSessionManager } from './exchange-session-manager';

export async function getContactDetails(
  exchangeIdentity: string,
): Promise<ContactsGetDetailsResult> {
  return await exchangeSessionManager.getContactDetails(exchangeIdentity);
}
