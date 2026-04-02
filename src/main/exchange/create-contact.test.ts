import { describe, expect, it, vi } from 'vitest';

vi.mock('./exchange-session-manager', () => ({
  exchangeSessionManager: {
    createContact: vi.fn(),
  },
}));

import { exchangeSessionManager } from './exchange-session-manager';

import { createContact } from './create-contact';

describe('createContact', () => {
  it('delegates to the exchange session manager', async () => {
    vi.mocked(exchangeSessionManager.createContact).mockResolvedValue({
      contact: {
        exchangeIdentity: 'jane@example.com',
        objectId: null,
        primaryEmail: 'jane@example.com',
        displayName: 'Jane Example',
        companyName: 'Example Corp',
      },
      verification: {
        attempted: true,
        companyApplied: true,
        detail: 'Verified contact creation and company assignment.',
      },
    });

    const result = await createContact({
      firstName: 'Jane',
      lastName: 'Example',
      email: 'jane@example.com',
      companyName: 'Example Corp',
    });

    expect(result.contact.displayName).toBe('Jane Example');
  });
});
