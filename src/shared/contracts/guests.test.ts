import { describe, expect, it } from 'vitest';

import {
  guestDetailsSchema,
  guestsGetDetailsPayloadSchema,
  guestsGetDetailsResultSchema,
  guestsInvitePayloadSchema,
  guestsInviteResultSchema,
  guestsInviteSuccessResultSchema,
  guestsSearchPayloadSchema,
  guestsSearchResultSchema,
  guestsUpdateCompanyPayloadSchema,
  guestsUpdateCompanyResultSchema,
} from './guests';

describe('guest contracts', () => {
  it('accepts strict guest search payloads', () => {
    expect(() => guestsSearchPayloadSchema.parse({ query: 'ja', limit: 25 })).not.toThrow();
    expect(() => guestsSearchPayloadSchema.parse({ query: 'a' })).toThrow();
    expect(() => guestsSearchPayloadSchema.parse({ query: 'ja', extra: true })).toThrow();
    expect(() => guestsGetDetailsPayloadSchema.parse({ stableKey: 'graph:objectId:55e10b98-21dd-41f2-92bb-ebc888d66fc0' })).not.toThrow();
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
        companyName: 'Guest Co',
        sendInvitationMessage: false,
      }),
    ).not.toThrow();

    expect(() =>
      guestsUpdateCompanyPayloadSchema.parse({
        guestUserId: 'guest-1',
        companyName: 'Guest Co',
      }),
    ).not.toThrow();

    const result = guestsInviteResultSchema.parse({
      outcome: 'invited',
      invitationId: 'invite-1',
      invitedUserId: 'guest-1',
      invitedUserEmail: 'guest@example.com',
      invitedUserDisplayName: 'Guest Example',
      invitedUserUserPrincipalName: 'guest_example.com#EXT#@tenant.onmicrosoft.com',
      companyName: 'Guest Co',
      inviteRedeemUrl: 'https://invitations.microsoft.com/redeem',
      status: 'PendingAcceptance',
      companyUpdate: {
        attempted: true,
        updated: true,
        detail: 'Verified guest company update.',
      },
      verification: {
        attempted: true,
        foundGuest: true,
        detail: 'Verified invited guest in Microsoft Graph.',
      },
    });

    const blocked = guestsInviteResultSchema.parse({
      outcome: 'blockedConflict',
      conflict: {
        action: 'guests.invite',
        category: 'emailAlreadyOwned',
        blocking: true,
        targetEmail: 'guest@example.com',
        message: 'A guest already exists for this email address.',
        guidance: 'Use the existing guest account instead.',
        records: [
          {
            source: 'graph',
            recipientType: 'guestUser',
            objectId: 'guest-1',
            exchangeIdentity: null,
            userPrincipalName: 'guest_example.com#EXT#@tenant.onmicrosoft.com',
            displayName: 'Guest Example',
            primaryEmail: 'guest@example.com',
            alternateEmails: ['guest@example.com'],
          },
        ],
      },
    });

    expect(guestsInviteSuccessResultSchema.parse(result).verification.foundGuest).toBe(true);
    expect(blocked.outcome).toBe('blockedConflict');
    if (blocked.outcome !== 'blockedConflict') {
      throw new Error('Expected blocked guest invite result.');
    }
    expect(blocked.conflict.category).toBe('emailAlreadyOwned');

    const updateResult = guestsUpdateCompanyResultSchema.parse({
      guestUserId: 'guest-1',
      companyName: 'New Guest Co',
      verification: {
        attempted: true,
        foundGuest: true,
        companyApplied: true,
        detail: 'Verified guest company update.',
      },
    });

    expect(updateResult.verification.companyApplied).toBe(true);
  });

  it('accepts guest detail payloads and results', () => {
    const result = guestsGetDetailsResultSchema.parse({
      guest: {
        stableKey: 'graph:objectId:55e10b98-21dd-41f2-92bb-ebc888d66fc0',
        objectId: '55e10b98-21dd-41f2-92bb-ebc888d66fc0',
        displayName: 'Guest Example',
        primaryEmail: 'guest@example.com',
        userPrincipalName: 'guest_example.com#EXT#@tenant.onmicrosoft.com',
        companyName: 'Guest Co',
        externalUserState: 'Accepted',
        givenName: 'Guest',
        surname: 'Example',
        jobTitle: 'Consultant',
        department: 'Field',
        mobilePhone: '+1 555-0101',
        officeLocation: 'Remote',
        preferredLanguage: 'en-US',
        createdDateTime: '2026-04-14T12:00:00.000Z',
        accountEnabled: true,
      },
    });

    expect(guestDetailsSchema.parse(result.guest).jobTitle).toBe('Consultant');
  });
});
