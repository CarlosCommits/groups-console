import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/main/recipients/resolve-recipient-for-membership', () => ({
  resolveRecipientForMembership: vi.fn(),
}));

vi.mock('./exchange-session-manager', () => ({
  exchangeSessionManager: {
    addMembers: vi.fn(),
  },
}));

import { resolveRecipientForMembership } from '@/main/recipients/resolve-recipient-for-membership';

import { exchangeSessionManager } from './exchange-session-manager';
import { addGroupMembers } from './add-group-members';

describe('addGroupMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves graph guest selections before delegating to Exchange', async () => {
    vi.mocked(resolveRecipientForMembership)
      .mockResolvedValueOnce({
        kind: 'exchangeDirect',
        member: {
          exchangeIdentity: 'jane@example.com',
          objectId: 'recipient-1',
          primaryEmail: 'jane@example.com',
        },
      })
      .mockResolvedValueOnce({
        kind: 'exchangeDirect',
        member: {
          exchangeIdentity: 'Guest_abc123',
          objectId: 'guest-1',
          primaryEmail: 'guest@example.com',
        },
      });
    vi.mocked(exchangeSessionManager.addMembers).mockResolvedValue({
      group: {
        exchangeIdentity: 'finance-group',
        objectId: null,
        groupKind: 'distributionList',
      },
      summary: {
        requested: 2,
        added: 2,
        alreadyMember: 0,
        invalid: 0,
        verificationFailed: 0,
        failed: 0,
      },
      items: [
        {
          member: {
            exchangeIdentity: 'jane@example.com',
            objectId: 'recipient-1',
            primaryEmail: 'jane@example.com',
          },
          status: 'added',
          detail: 'Added successfully.',
        },
        {
          member: {
            exchangeIdentity: 'Guest_abc123',
            objectId: 'guest-1',
            primaryEmail: 'guest@example.com',
          },
          status: 'added',
          detail: 'Added successfully.',
        },
      ],
      verification: {
        attempted: true,
        verifiedAdded: 2,
        detail: 'Verified 2 added member(s).',
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
          kind: 'exchangeRecipient',
          exchangeIdentity: 'jane@example.com',
          objectId: 'recipient-1',
          primaryEmail: 'jane@example.com',
          displayName: 'Jane Example',
        },
        {
          kind: 'graphGuest',
          objectId: 'guest-1',
          primaryEmail: 'guest@example.com',
          displayName: 'Guest Example',
        },
      ],
      verify: true,
    });

    expect(exchangeSessionManager.addMembers).toHaveBeenCalledWith({
      group: {
        exchangeIdentity: 'finance-group',
        objectId: null,
        groupKind: 'distributionList',
      },
      members: [
        {
          exchangeIdentity: 'jane@example.com',
          objectId: 'recipient-1',
          primaryEmail: 'jane@example.com',
        },
        {
          exchangeIdentity: 'Guest_abc123',
          objectId: 'guest-1',
          primaryEmail: 'guest@example.com',
        },
      ],
      verify: true,
    });
    expect(result.summary.added).toBe(2);
  });

  it('returns invalid items when selected guests cannot be resolved', async () => {
    vi.mocked(resolveRecipientForMembership).mockResolvedValue({
      kind: 'graphDeferred',
      reason: 'The selected guest is not yet visible in Exchange as a GuestMailUser.',
    });

    const result = await addGroupMembers({
      group: {
        exchangeIdentity: 'finance-group',
        objectId: null,
        groupKind: 'distributionList',
      },
      members: [
        {
          kind: 'graphGuest',
          objectId: 'guest-1',
          primaryEmail: 'guest@example.com',
          displayName: 'Guest Example',
        },
      ],
      verify: true,
    });

    expect(exchangeSessionManager.addMembers).not.toHaveBeenCalled();
    expect(result.summary.invalid).toBe(1);
    expect(result.items[0]).toEqual({
      member: {
        exchangeIdentity: 'guest@example.com',
        objectId: 'guest-1',
        primaryEmail: 'guest@example.com',
      },
      status: 'invalid',
      detail: 'The selected guest is not yet visible in Exchange as a GuestMailUser.',
    });
  });
});
