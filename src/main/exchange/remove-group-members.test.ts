import { describe, expect, it, vi } from 'vitest';

vi.mock('./exchange-session-manager', () => ({
  exchangeSessionManager: {
    removeMembers: vi.fn(),
  },
}));

import { exchangeSessionManager } from './exchange-session-manager';

import { removeGroupMembers } from './remove-group-members';

describe('removeGroupMembers', () => {
  it('delegates to the exchange session manager', async () => {
    vi.mocked(exchangeSessionManager.removeMembers).mockResolvedValue({
      group: {
        exchangeIdentity: 'finance-group',
        objectId: null,
        groupKind: 'distributionList',
      },
      summary: {
        requested: 1,
        removed: 1,
        notMember: 0,
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
          status: 'removed',
          detail: 'Removed successfully.',
        },
      ],
      verification: {
        attempted: true,
        verifiedRemoved: 1,
        detail: 'Verified removed members.',
      },
    });

    const result = await removeGroupMembers({
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

    expect(result.summary.removed).toBe(1);
    expect(exchangeSessionManager.removeMembers).toHaveBeenCalledTimes(1);
  });
});
