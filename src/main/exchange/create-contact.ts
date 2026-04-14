import type { ContactsCreatePayload, ContactsCreateResult } from '@/shared/contracts/contacts';

import { checkRecipientConflicts } from '@/main/recipients/recipient-conflict-service';

import { exchangeSessionManager } from './exchange-session-manager';

export async function createContact(
  payload: ContactsCreatePayload,
): Promise<ContactsCreateResult> {
  const conflict = await checkRecipientConflicts('contacts.create', payload.email);

  if (conflict) {
    if (conflict.action !== 'contacts.create') {
      throw new Error('Contact conflict preflight returned an unexpected action.');
    }

    return {
      outcome: 'blockedConflict',
      conflict,
    };
  }

  return await exchangeSessionManager.createContact(payload);
}
