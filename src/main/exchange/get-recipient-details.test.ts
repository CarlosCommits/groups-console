import { describe, expect, it, vi } from 'vitest';

vi.mock('./exchange-session-manager', () => ({
  exchangeSessionManager: {
    getRecipientDetails: vi.fn(),
  },
}));

import { exchangeSessionManager } from './exchange-session-manager';
import { getExchangeRecipientDetails } from './get-recipient-details';

describe('getExchangeRecipientDetails', () => {
  it('delegates to the exchange session manager', async () => {
    vi.mocked(exchangeSessionManager.getRecipientDetails).mockResolvedValue({
      recipient: {
        exchangeIdentity: 'jane.external@example.com',
        objectId: 'recipient-1',
        primaryEmail: 'jane@yourcompany.com',
        externalEmailAddress: 'jane.personal@example.com',
        displayName: 'Jane External',
        alias: 'jexternal',
        companyName: 'Example Corp',
        firstName: 'Jane',
        lastName: 'External',
        title: 'Director',
        department: 'Operations',
        phone: '+1 555-0100',
        office: 'HQ-201',
        userPrincipalName: 'jane_external#EXT#@tenant.onmicrosoft.com',
        recipientType: 'mailUser',
        recipientTypeDetails: 'MailUser',
      },
    });

    const result = await getExchangeRecipientDetails('jane.external@example.com');

    expect(result.recipient.recipientType).toBe('mailUser');
    expect(result.recipient.externalEmailAddress).toBe('jane.personal@example.com');
  });
});
