import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/main/recipients/resolve-recipient-for-membership', () => ({
  resolveRecipientForMembership: vi.fn(),
}));

vi.mock('./exchange-session-manager', () => ({
  exchangeSessionManager: {
    getGroupMemberships: vi.fn(),
  },
}));

import { resolveRecipientForMembership } from '@/main/recipients/resolve-recipient-for-membership';

import { exchangeSessionManager } from './exchange-session-manager';
import { getGroupMemberships } from './get-group-memberships';

describe('getGroupMemberships', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves the requested member before delegating to the exchange session manager', async () => {
    vi.mocked(resolveRecipientForMembership).mockResolvedValue({
      kind: 'exchangeDirect',
      member: {
        exchangeIdentity: 'jane@example.com',
        objectId: 'recipient-1',
        primaryEmail: 'jane@example.com',
      },
    });
    vi.mocked(exchangeSessionManager.getGroupMemberships).mockResolvedValue({
      member: {
        exchangeIdentity: 'jane@example.com',
        objectId: 'recipient-1',
        primaryEmail: 'jane@example.com',
      },
      items: [
        {
          objectId: 'group-1',
          exchangeIdentity: 'finance-group',
          displayName: 'Finance Distribution',
          alias: 'finance',
          primaryEmail: 'finance@example.com',
          groupKind: 'distributionList',
          managedByDisplayNames: [],
          whenChangedUtc: null,
        },
      ],
    });

    const result = await getGroupMemberships({
      member: {
        kind: 'exchangeRecipient',
        exchangeIdentity: 'jane@example.com',
        objectId: 'recipient-1',
        primaryEmail: 'jane@example.com',
        displayName: 'Jane Example',
      },
    });

    expect(exchangeSessionManager.getGroupMemberships).toHaveBeenCalledWith({
      member: {
        exchangeIdentity: 'jane@example.com',
        objectId: 'recipient-1',
        primaryEmail: 'jane@example.com',
      },
    });
    expect(result.items[0]?.exchangeIdentity).toBe('finance-group');
  });

  it('surfaces deferred guest resolution failures without querying Exchange memberships', async () => {
    vi.mocked(resolveRecipientForMembership).mockResolvedValue({
      kind: 'graphDeferred',
      reason: 'Microsoft Graph must be connected before a guest can be resolved for membership.',
    });

    await expect(
      getGroupMemberships({
        member: {
          kind: 'graphGuest',
          objectId: '00000000-0000-0000-0000-000000000001',
          primaryEmail: 'guest@example.com',
          displayName: 'Guest Example',
        },
      }),
    ).rejects.toThrow(
      'Microsoft Graph must be connected before a guest can be resolved for membership.',
    );

    expect(exchangeSessionManager.getGroupMemberships).not.toHaveBeenCalled();
  });
});
