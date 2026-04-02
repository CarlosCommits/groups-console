import { describe, expect, it } from 'vitest';

import {
  contactsCreatePayloadSchema,
  contactsCreateResultSchema,
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

    expect(created.contact.companyName).toBe('Example Corp');
    expect(updated.contact.companyName).toBe('New Company');
  });
});
