import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/main/recipients/recipient-conflict-service', () => ({
  checkRecipientConflicts: vi.fn(),
}));

vi.mock('./exchange-session-manager', () => ({
  exchangeSessionManager: {
    createContact: vi.fn(),
  },
}));

import { checkRecipientConflicts } from '@/main/recipients/recipient-conflict-service';
import { exchangeSessionManager } from './exchange-session-manager';

import { createContact } from './create-contact';

describe('createContact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to the exchange session manager', async () => {
    vi.mocked(checkRecipientConflicts).mockResolvedValue(null);
    vi.mocked(exchangeSessionManager.createContact).mockResolvedValue({
      outcome: 'created',
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
      displayName: 'Jane Example',
      alias: 'jexample',
      firstName: 'Jane',
      lastName: 'Example',
      email: 'jane@example.com',
      companyName: 'Example Corp',
    });

    expect(result.outcome).toBe('created');
    if (result.outcome !== 'created') {
      throw new Error('Expected createContact to return a created result.');
    }

    expect(result.contact.displayName).toBe('Jane Example');
  });

  it('returns a blocked conflict result without calling Exchange when preflight fails', async () => {
    vi.mocked(checkRecipientConflicts).mockResolvedValue({
      action: 'contacts.create',
      category: 'guestContactOverlap',
      blocking: true,
      targetEmail: 'jane@example.com',
      message: 'A guest already exists for this email.',
      guidance: 'Use the existing guest instead.',
      records: [],
    });

    const result = await createContact({
      displayName: 'Jane Example',
      alias: 'jexample',
      firstName: 'Jane',
      lastName: 'Example',
      email: 'jane@example.com',
      companyName: 'Example Corp',
    });

    expect(result).toEqual({
      outcome: 'blockedConflict',
      conflict: expect.objectContaining({
        category: 'guestContactOverlap',
      }),
    });
    expect(exchangeSessionManager.createContact).not.toHaveBeenCalled();
  });
});
