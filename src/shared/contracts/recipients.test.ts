import { describe, expect, it } from 'vitest';

import {
  recipientsSearchPayloadSchema,
  recipientsSearchResultSchema,
} from './recipients';

describe('recipient search contracts', () => {
  it('accepts valid strict search payloads', () => {
    expect(() =>
      recipientsSearchPayloadSchema.parse({
        query: 'ja',
        limit: 25,
        types: ['mailbox', 'mailContact'],
      }),
    ).not.toThrow();

    expect(() => recipientsSearchPayloadSchema.parse({ query: 'a' })).toThrow();
    expect(() => recipientsSearchPayloadSchema.parse({ query: 'ja', limit: 101 })).toThrow();
    expect(() => recipientsSearchPayloadSchema.parse({ query: 'ja', extra: true })).toThrow();
  });

  it('accepts a normalized recipient search result payload', () => {
    const result = recipientsSearchResultSchema.parse({
      query: 'ja',
      appliedLimit: 25,
      appliedTypes: ['mailbox', 'mailContact'],
      sourceStatus: {
        exchange: 'searched',
        graph: 'deferred',
      },
      items: [
        {
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
        },
      ],
    });

    expect(result.items[0]?.recipientType).toBe('mailbox');
  });
});
