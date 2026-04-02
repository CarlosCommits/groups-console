import { describe, expect, it, vi } from 'vitest';

vi.mock('./exchange-session-manager', () => ({
  exchangeSessionManager: {
    updateContactCompany: vi.fn(),
  },
}));

import { exchangeSessionManager } from './exchange-session-manager';

import { updateContactCompany } from './update-contact-company';

describe('updateContactCompany', () => {
  it('delegates to the exchange session manager', async () => {
    vi.mocked(exchangeSessionManager.updateContactCompany).mockResolvedValue({
      contact: {
        exchangeIdentity: 'jane@example.com',
        objectId: null,
        primaryEmail: 'jane@example.com',
        companyName: 'New Company',
      },
      verification: {
        attempted: true,
        companyApplied: true,
        detail: 'Verified company update.',
      },
    });

    const result = await updateContactCompany({
      exchangeIdentity: 'jane@example.com',
      companyName: 'New Company',
    });

    expect(result.contact.companyName).toBe('New Company');
  });
});
