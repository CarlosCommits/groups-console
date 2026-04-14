import { describe, expect, it } from 'vitest';

import {
  contactsCreatePayloadSchema,
  contactsCreateResultSchema,
  contactsCreateSuccessResultSchema,
  contactsUpdateCompanyPayloadSchema,
  contactsUpdateCompanyResultSchema,
} from './contacts';

describe('contact contracts', () => {
  it('accepts strict contact create payloads', () => {
    expect(() =>
      contactsCreatePayloadSchema.parse({
        firstName: 'Jane',
        lastName: 'Example',
        email: 'jane@example.com',
        companyName: 'Example Corp',
      }),
    ).not.toThrow();

    expect(() => contactsCreatePayloadSchema.parse({ firstName: 'Jane' })).toThrow();
  });

  it('accepts strict contact company update payloads', () => {
    expect(() =>
      contactsUpdateCompanyPayloadSchema.parse({
        exchangeIdentity: 'jane@example.com',
        companyName: 'Example Corp',
      }),
    ).not.toThrow();
  });

  it('accepts contact create/update result payloads', () => {
    const created = contactsCreateResultSchema.parse({
      outcome: 'created',
      contact: {
        exchangeIdentity: 'jane@example.com',
        objectId: null,
        primaryEmail: 'jane@example.com',
        displayName: 'Jane Example',
        companyName: 'Example Corp',
      },
      verification: {
        attempted: true,
        companyApplied: true,
        detail: 'Verified contact creation and company assignment.',
      },
    });

    const blocked = contactsCreateResultSchema.parse({
      outcome: 'blockedConflict',
      conflict: {
        action: 'contacts.create',
        category: 'guestContactOverlap',
        blocking: true,
        targetEmail: 'jane@example.com',
        message: 'A guest already exists for this email.',
        guidance: 'Use the existing guest user instead.',
        records: [
          {
            source: 'graph',
            recipientType: 'guestUser',
            objectId: 'guest-1',
            exchangeIdentity: null,
            userPrincipalName: 'jane_example.com#EXT#@tenant.onmicrosoft.com',
            displayName: 'Jane Example',
            primaryEmail: 'jane@example.com',
            alternateEmails: ['jane@example.com'],
          },
        ],
      },
    });

    const updated = contactsUpdateCompanyResultSchema.parse({
      contact: {
        exchangeIdentity: 'jane@example.com',
        objectId: null,
        primaryEmail: 'jane@example.com',
        companyName: 'New Company',
      },
      verification: {
        attempted: true,
        companyApplied: true,
        detail: 'Verified company update.',
      },
    });

    expect(contactsCreateSuccessResultSchema.parse(created).contact.companyName).toBe('Example Corp');
    expect(blocked.outcome).toBe('blockedConflict');
    if (blocked.outcome !== 'blockedConflict') {
      throw new Error('Expected blocked contact create result.');
    }
    expect(blocked.conflict.category).toBe('guestContactOverlap');
    expect(updated.contact.companyName).toBe('New Company');
  });
});
