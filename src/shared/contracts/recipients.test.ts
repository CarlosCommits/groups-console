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
      sourceFailures: {
        graph: {
          message: 'Microsoft Graph is connected, but the tenant does not match the current Exchange session.',
          classification: {
            category: 'tenantMismatch',
            remediation: 'reconnectMatchedTenant',
            backend: 'graph',
            operation: 'recipients.search',
            guidance: 'Reconnect Microsoft Graph and Exchange with the same tenant, then retry the operation.',
          },
        },
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
    expect(result.sourceFailures?.graph?.classification.category).toBe('tenantMismatch');
  });
});
