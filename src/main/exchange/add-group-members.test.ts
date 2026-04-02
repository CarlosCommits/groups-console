import { describe, expect, it, vi } from 'vitest';

vi.mock('./exchange-session-manager', () => ({
  exchangeSessionManager: {
    addMembers: vi.fn(),
  },
}));

import { exchangeSessionManager } from './exchange-session-manager';

import { addGroupMembers } from './add-group-members';

describe('addGroupMembers', () => {
  it('delegates to the exchange session manager', async () => {
    vi.mocked(exchangeSessionManager.addMembers).mockResolvedValue({
      group: {
        exchangeIdentity: 'finance-group',
        objectId: null,
        groupKind: 'distributionList',
      },
      summary: {
        requested: 1,
        added: 1,
        alreadyMember: 0,
        invalid: 0,
        verificationFailed: 0,
        failed: 0,
      },
      items: [
        {
          member: {
            exchangeIdentity: 'jane@example.com',
            objectId: null,
            primaryEmail: 'jane@example.com',
          },
          status: 'added',
          detail: 'Added successfully.',
        },
      ],
      verification: {
        attempted: true,
        verifiedAdded: 1,
        detail: 'Verified 1 added member.',
      },
    });

    const result = await addGroupMembers({
      group: {
        exchangeIdentity: 'finance-group',
        objectId: null,
        groupKind: 'distributionList',
      },
      members: [
        {
          exchangeIdentity: 'jane@example.com',
          objectId: null,
          primaryEmail: 'jane@example.com',
        },
      ],
      verify: true,
    });

    expect(result.summary.added).toBe(1);
    expect(exchangeSessionManager.addMembers).toHaveBeenCalledTimes(1);
  });
});
