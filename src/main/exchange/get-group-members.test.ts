import { describe, expect, it, vi } from 'vitest';

vi.mock('./exchange-session-manager', () => ({
  exchangeSessionManager: {
    getGroupMembers: vi.fn(),
  },
}));

import { exchangeSessionManager } from './exchange-session-manager';

import { createGroupMembersPayload, getGroupMembers } from './get-group-members';

describe('getGroupMembers', () => {
  it('delegates to the exchange session manager', async () => {
    vi.mocked(exchangeSessionManager.getGroupMembers).mockResolvedValue({
      group: {
        exchangeIdentity: 'finance-group',
        objectId: null,
        groupKind: 'distributionList',
      },
      items: [
        {
          objectId: 'recipient-1',
          exchangeIdentity: 'recipient-identity-1',
          displayName: 'Jane Example',
          primaryEmail: 'jane@example.com',
          alias: 'jexample',
          recipientType: 'mailbox',
          recipientTypeDetails: 'UserMailbox',
        },
      ],
    });

    const result = await getGroupMembers({
      group: {
        exchangeIdentity: 'finance-group',
        objectId: null,
        groupKind: 'distributionList',
      },
    });

    expect(result.items).toHaveLength(1);
    expect(exchangeSessionManager.getGroupMembers).toHaveBeenCalledWith({
      group: {
        exchangeIdentity: 'finance-group',
        objectId: null,
        groupKind: 'distributionList',
      },
    });
  });

  it('builds a payload from a shared group ref', () => {
    const payload = createGroupMembersPayload({
      exchangeIdentity: 'finance-group',
      objectId: null,
      groupKind: 'distributionList',
    });

    expect(payload.group.exchangeIdentity).toBe('finance-group');
  });
});
