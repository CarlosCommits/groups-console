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
import { resolvedGroupsAddMembersPayloadSchema } from '@/shared/contracts/exchange';

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

  it.each([null, 'guest-directory-id'])('writes a resolved guest once and keeps a same-email contact separate with object ID %s', async (guestObjectId) => {
    const group = {
      exchangeIdentity: 'finance-group',
      objectId: null,
      groupKind: 'distributionList' as const,
    };
    const guest = {
      exchangeIdentity: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      objectId: guestObjectId,
      primaryEmail: 'shared@example.com',
    };
    const contact = {
      exchangeIdentity: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      objectId: 'contact-directory-id',
      primaryEmail: 'shared@example.com',
    };
    vi.mocked(resolveRecipientForMembership)
      .mockResolvedValueOnce({ kind: 'exchangeDirect', member: guest })
      .mockResolvedValueOnce({ kind: 'exchangeDirect', member: { ...guest, exchangeIdentity: guest.exchangeIdentity.toUpperCase() } })
      .mockResolvedValueOnce({ kind: 'exchangeDirect', member: contact });
    vi.mocked(exchangeSessionManager.addMembers).mockImplementation((payload) => {
      // The real session manager rejects duplicate resolved write identities.
      resolvedGroupsAddMembersPayloadSchema.parse(payload);
      return Promise.resolve({
        group,
        summary: { requested: 2, added: 2, alreadyMember: 0, invalid: 0, verificationFailed: 0, failed: 0 },
        items: [guest, contact].map((member) => ({ member, status: 'added' as const, detail: 'Added successfully.' })),
        verification: { attempted: true, verifiedAdded: 2, detail: 'Verified 2 added members.' },
      });
    });

    const result = await addGroupMembers({
      group,
      members: [
        { kind: 'exchangeRecipient', ...guest, displayName: 'Guest Example' },
        { kind: 'graphGuest', objectId: 'guest-directory-id', primaryEmail: guest.primaryEmail, displayName: 'Guest Example' },
        { kind: 'exchangeRecipient', ...contact, displayName: 'Contact Example' },
      ],
      verify: true,
    });

    expect(exchangeSessionManager.addMembers).toHaveBeenCalledExactlyOnceWith({ group, members: [guest, contact], verify: true });
    expect(result.summary).toMatchObject({ requested: 2, added: 2 });
    expect(result.items).toHaveLength(2);
  });

  it('does not silently collapse recipients with conflicting object IDs and a shared write identity', async () => {
    const group = { exchangeIdentity: 'finance-group', objectId: null, groupKind: 'distributionList' as const };
    const contact = { exchangeIdentity: 'Shared Display Identity', objectId: 'contact-id', primaryEmail: 'shared@example.com' };
    const guest = { ...contact, objectId: 'guest-id' };
    vi.mocked(resolveRecipientForMembership)
      .mockResolvedValueOnce({ kind: 'exchangeDirect', member: contact })
      .mockResolvedValueOnce({ kind: 'exchangeDirect', member: guest });
    vi.mocked(exchangeSessionManager.addMembers).mockImplementation((payload) => {
      resolvedGroupsAddMembersPayloadSchema.parse(payload);
      return Promise.reject(new Error('Ambiguous write identities must be rejected before this point.'));
    });

    await expect(addGroupMembers({
      group,
      members: [
        { kind: 'exchangeRecipient', ...contact, displayName: 'Contact Example' },
        { kind: 'graphGuest', objectId: guest.objectId, primaryEmail: guest.primaryEmail, displayName: 'Guest Example' },
      ],
      verify: true,
    })).rejects.toThrow('Duplicate member exchangeIdentity values');
    expect(exchangeSessionManager.addMembers).toHaveBeenCalledExactlyOnceWith({ group, members: [contact, guest], verify: true });
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
