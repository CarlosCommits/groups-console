import { describe, expect, it } from 'vitest';

import { resolveRecipientForMembership } from './resolve-recipient-for-membership';

describe('resolveRecipientForMembership', () => {
  it('maps exchange-direct recipients into membership refs', () => {
    const result = resolveRecipientForMembership({
      source: 'exchange',
      stableKey: 'exchange:objectId:recipient-1',
      recipientType: 'mailbox',
      membershipSupport: 'exchangeDirect',
      objectId: 'recipient-1',
      exchangeIdentity: 'jane@example.com',
      primaryEmail: 'jane@example.com',
      displayName: 'Jane Example',
      alias: 'jexample',
      recipientTypeDetails: 'UserMailbox',
      companyName: 'Example Corp',
      companySource: 'exchange',
    });

    expect(result.kind).toBe('exchangeDirect');
    if (result.kind === 'exchangeDirect') {
      expect(result.member.exchangeIdentity).toBe('jane@example.com');
    }
  });

  it('marks guest candidates as graphDeferred', () => {
    const result = resolveRecipientForMembership({
      source: 'graph',
      stableKey: 'graph:objectId:guest-1',
      recipientType: 'guestUser',
      membershipSupport: 'graphDeferred',
      objectId: 'guest-1',
      exchangeIdentity: null,
      primaryEmail: 'guest@example.com',
      displayName: 'Guest Example',
      alias: null,
      recipientTypeDetails: null,
      companyName: null,
      companySource: 'graph',
    });

    expect(result.kind).toBe('graphDeferred');
  });
});
