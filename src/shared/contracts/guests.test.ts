import { describe, expect, it } from 'vitest';

import {
  guestsInvitePayloadSchema,
  guestsInviteResultSchema,
  guestsSearchPayloadSchema,
  guestsSearchResultSchema,
} from './guests';

describe('guest contracts', () => {
  it('accepts strict guest search payloads', () => {
    expect(() => guestsSearchPayloadSchema.parse({ query: 'ja', limit: 25 })).not.toThrow();
    expect(() => guestsSearchPayloadSchema.parse({ query: 'a' })).toThrow();
    expect(() => guestsSearchPayloadSchema.parse({ query: 'ja', extra: true })).toThrow();
  });

  it('accepts a guest search result payload', () => {
    const result = guestsSearchResultSchema.parse({
      query: 'ja',
      appliedLimit: 25,
      items: [
        {
          stableKey: 'graph:objectId:guest-1',
          objectId: 'guest-1',
          displayName: 'Guest Example',
          primaryEmail: 'guest@example.com',
          userPrincipalName: 'guest_example.com#EXT#@tenant.onmicrosoft.com',
          companyName: 'Guest Co',
          externalUserState: 'Accepted',
        },
      ],
    });

    expect(result.items[0]?.externalUserState).toBe('Accepted');
  });

  it('accepts invite payloads and results', () => {
    expect(() =>
      guestsInvitePayloadSchema.parse({
        email: 'guest@example.com',
        displayName: 'Guest Example',
        sendInvitationMessage: false,
      }),
    ).not.toThrow();

    const result = guestsInviteResultSchema.parse({
      invitationId: 'invite-1',
      invitedUserId: 'guest-1',
      invitedUserEmail: 'guest@example.com',
      invitedUserDisplayName: 'Guest Example',
      invitedUserUserPrincipalName: 'guest_example.com#EXT#@tenant.onmicrosoft.com',
      inviteRedeemUrl: 'https://invitations.microsoft.com/redeem',
      status: 'PendingAcceptance',
      verification: {
        attempted: true,
        foundGuest: true,
        detail: 'Verified invited guest in Microsoft Graph.',
      },
    });

    expect(result.verification.foundGuest).toBe(true);
  });
});
