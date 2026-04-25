import { describe, expect, it } from 'vitest';

import {
  contactDetailsSchema,
  contactsCreatePayloadSchema,
  contactsCreateResultSchema,
  contactsCreateSuccessResultSchema,
  contactsGetDetailsPayloadSchema,
  contactsGetDetailsResultSchema,
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

    expect(() =>
      contactsUpdateCompanyPayloadSchema.parse({
        exchangeIdentity: 'jane@example.com',
        companyName: '',
      }),
    ).not.toThrow();

    expect(() =>
      contactsGetDetailsPayloadSchema.parse({
        stableKey: 'exchange:objectId:contact-1',
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

  it('accepts contact detail payloads and results', () => {
    const result = contactsGetDetailsResultSchema.parse({
      contact: {
        exchangeIdentity: 'jane@example.com',
        objectId: 'contact-1',
        primaryEmail: 'jane@example.com',
        displayName: 'Jane Example',
        alias: 'jexample',
        companyName: 'Example Corp',
        firstName: 'Jane',
        lastName: 'Example',
        title: 'Director',
        department: 'Operations',
        phone: '+1 555-0100',
        office: 'HQ-201',
        streetAddress: '1 Example Way',
        city: 'New York',
        stateOrProvince: 'NY',
        postalCode: '10001',
        countryOrRegion: 'US',
        recipientTypeDetails: 'MailContact',
      },
    });

    expect(contactDetailsSchema.parse(result.contact).firstName).toBe('Jane');
  });
});
