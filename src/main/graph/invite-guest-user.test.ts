import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/main/recipients/recipient-conflict-service', () => ({
  checkRecipientConflicts: vi.fn(),
}));

vi.mock('./graph-session-manager', () => ({
  graphSessionManager: {
    inviteGuest: vi.fn(),
  },
}));

import { checkRecipientConflicts } from '@/main/recipients/recipient-conflict-service';
import { graphSessionManager } from './graph-session-manager';

import { inviteGuestUser } from './invite-guest-user';

describe('inviteGuestUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to the graph session manager', async () => {
    vi.mocked(checkRecipientConflicts).mockResolvedValue(null);
    vi.mocked(graphSessionManager.inviteGuest).mockResolvedValue({
      outcome: 'invited',
      invitationId: 'invite-1',
      invitedUserId: 'guest-1',
      invitedUserEmail: 'guest@example.com',
      invitedUserDisplayName: 'Guest Example',
      invitedUserUserPrincipalName: 'guest_example.com#EXT#@tenant.onmicrosoft.com',
      companyName: null,
      inviteRedeemUrl: 'https://example.com/invite',
      status: 'PendingAcceptance',
      companyUpdate: {
        attempted: false,
        updated: false,
        detail: 'No company update was requested.',
      },
      verification: {
        attempted: true,
        foundGuest: true,
        detail: 'Verified invited guest in Microsoft Graph.',
      },
    });

    const result = await inviteGuestUser({ email: 'guest@example.com' });

    expect(result.outcome).toBe('invited');
    if (result.outcome !== 'invited') {
      throw new Error('Expected inviteGuestUser to return an invited result.');
    }

    expect(result.invitedUserId).toBe('guest-1');
  });

  it('returns a blocked conflict result without calling Graph when preflight fails', async () => {
    vi.mocked(checkRecipientConflicts).mockResolvedValue({
      action: 'guests.invite',
      category: 'emailAlreadyOwned',
      blocking: true,
      targetEmail: 'guest@example.com',
      message: 'A guest already exists for this email address.',
      guidance: 'Use the existing guest account instead.',
      records: [],
    });

    const result = await inviteGuestUser({ email: 'guest@example.com' });

    expect(result).toEqual({
      outcome: 'blockedConflict',
      conflict: expect.objectContaining({
        category: 'emailAlreadyOwned',
      }),
    });
    expect(graphSessionManager.inviteGuest).not.toHaveBeenCalled();
  });
});
