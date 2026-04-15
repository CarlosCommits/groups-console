import { describe, expect, it, vi } from 'vitest';

vi.mock('./exchange-session-manager', () => ({
  exchangeSessionManager: {
    getContactDetails: vi.fn(),
  },
}));

import { exchangeSessionManager } from './exchange-session-manager';
import { getContactDetails } from './get-contact-details';

describe('getContactDetails', () => {
  it('delegates to the exchange session manager', async () => {
    vi.mocked(exchangeSessionManager.getContactDetails).mockResolvedValue({
      contact: {
        exchangeIdentity: 'jane@example.com',
        objectId: 'contact-1',
        primaryEmail: 'jane@example.com',
        displayName: 'Jane Example',
        alias: 'jexample',
        companyName: 'Example Corp',
        firstName: 'Jane',
        lastName: 'Example',
        title: 'Director',
        department: 'Operations',
        phone: '+1 555-0100',
        office: 'HQ-201',
        streetAddress: '1 Example Way',
        city: 'New York',
        stateOrProvince: 'NY',
        postalCode: '10001',
        countryOrRegion: 'US',
        recipientTypeDetails: 'MailContact',
      },
    });

    const result = await getContactDetails('jane@example.com');

    expect(result.contact.displayName).toBe('Jane Example');
  });
});
