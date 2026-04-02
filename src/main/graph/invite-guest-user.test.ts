import { describe, expect, it, vi } from 'vitest';

vi.mock('./graph-session-manager', () => ({
  graphSessionManager: {
    inviteGuest: vi.fn(),
  },
}));

import { graphSessionManager } from './graph-session-manager';

import { inviteGuestUser } from './invite-guest-user';

describe('inviteGuestUser', () => {
  it('delegates to the graph session manager', async () => {
    vi.mocked(graphSessionManager.inviteGuest).mockResolvedValue({
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

    expect(result.invitedUserId).toBe('guest-1');
  });
});
