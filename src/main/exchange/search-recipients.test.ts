import { describe, expect, it, vi } from 'vitest';

vi.mock('./exchange-session-manager', () => ({
  exchangeSessionManager: {
    searchRecipients: vi.fn(),
  },
}));

import { exchangeSessionManager } from './exchange-session-manager';

import { searchExchangeRecipients } from './search-recipients';

describe('searchExchangeRecipients', () => {
  it('delegates to the exchange session manager', async () => {
    vi.mocked(exchangeSessionManager.searchRecipients).mockResolvedValue({
      query: 'ja',
      appliedLimit: 25,
      appliedTypes: ['mailbox'],
      sourceStatus: {
        exchange: 'searched',
        graph: 'deferred',
      },
      items: [
        {
          source: 'exchange',
          stableKey: 'exchange:objectId:recipient-1',
          recipientType: 'mailbox',
          membershipSupport: 'exchangeDirect',
          objectId: 'recipient-1',
          exchangeIdentity: 'jane@example.com',
          primaryEmail: 'jane@example.com',
          displayName: 'Jane Example',
          alias: 'jexample',
          recipientTypeDetails: 'UserMailbox',
          companyName: 'Example Corp',
          companySource: 'exchange',
        },
      ],
    });

    const result = await searchExchangeRecipients({
      query: 'ja',
      limit: 25,
      types: ['mailbox'],
    });

    expect(result.items[0]?.displayName).toBe('Jane Example');
  });
});
