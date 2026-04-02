import type {
  ContactsUpdateCompanyPayload,
  ContactsUpdateCompanyResult,
} from '@/shared/contracts/contacts';

import { exchangeSessionManager } from './exchange-session-manager';

export async function updateContactCompany(
  payload: ContactsUpdateCompanyPayload,
): Promise<ContactsUpdateCompanyResult> {
  return await exchangeSessionManager.updateContactCompany(payload);
}
