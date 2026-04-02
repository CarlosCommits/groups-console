import type { ContactsCreatePayload, ContactsCreateResult } from '@/shared/contracts/contacts';

import { exchangeSessionManager } from './exchange-session-manager';

export async function createContact(
  payload: ContactsCreatePayload,
): Promise<ContactsCreateResult> {
  return await exchangeSessionManager.createContact(payload);
}
