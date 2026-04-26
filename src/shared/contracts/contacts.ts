import { z } from 'zod';

import { recipientConflictSchema } from './conflicts';

const contactAliasSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9!#%*+\-/=?^_~]+(?:\.[A-Za-z0-9!#%*+\-/=?^_~]+)*$/, {
    message:
      'Alias can contain letters, numbers, ! # % * + - / = ? ^ _ ~, and periods between other valid characters.',
  });

const optionalContactTextSchema = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength).optional();

export const contactRefSchema = z
  .object({
    exchangeIdentity: z.string().min(1),
    objectId: z.string().nullable(),
    primaryEmail: z.string().email().nullable(),
  })
  .strict();

export const contactsCreatePayloadSchema = z
  .object({
    displayName: z.string().trim().min(1).max(256),
    alias: contactAliasSchema,
    firstName: optionalContactTextSchema(128),
    lastName: optionalContactTextSchema(128),
    email: z.string().email(),
    companyName: optionalContactTextSchema(256),
    title: optionalContactTextSchema(256),
    department: optionalContactTextSchema(256),
    phone: optionalContactTextSchema(64),
    office: optionalContactTextSchema(256),
    streetAddress: optionalContactTextSchema(256),
    city: optionalContactTextSchema(128),
    stateOrProvince: optionalContactTextSchema(128),
    postalCode: optionalContactTextSchema(40),
    countryOrRegion: optionalContactTextSchema(128),
  })
  .strict();

export const contactsGetDetailsPayloadSchema = z
  .object({
    stableKey: z.string().min(1),
  })
  .strict();

export const contactDetailsSchema = contactRefSchema.extend({
  displayName: z.string().min(1),
  alias: z.string().nullable(),
  companyName: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  title: z.string().nullable(),
  department: z.string().nullable(),
  phone: z.string().nullable(),
  office: z.string().nullable(),
  streetAddress: z.string().nullable(),
  city: z.string().nullable(),
  stateOrProvince: z.string().nullable(),
  postalCode: z.string().nullable(),
  countryOrRegion: z.string().nullable(),
  recipientTypeDetails: z.literal('MailContact'),
});

export const contactsGetDetailsResultSchema = z.object({
  contact: contactDetailsSchema,
});

export const contactsCreateSuccessResultSchema = z.object({
  outcome: z.literal('created'),
  contact: contactRefSchema.extend({
    displayName: z.string().min(1),
    companyName: z.string().nullable(),
  }),
  verification: z.object({
    attempted: z.literal(true),
    companyApplied: z.boolean(),
    detail: z.string().min(1),
  }),
});

export const contactsCreateBlockedResultSchema = z.object({
  outcome: z.literal('blockedConflict'),
  conflict: recipientConflictSchema.extend({
    action: z.literal('contacts.create'),
  }),
});

export const contactsCreateResultSchema = z.discriminatedUnion('outcome', [
  contactsCreateSuccessResultSchema,
  contactsCreateBlockedResultSchema,
]);

export const contactsUpdateCompanyPayloadSchema = z
  .object({
    exchangeIdentity: z.string().min(1),
    companyName: z.string().trim().max(256),
  })
  .strict();

export const contactsUpdateCompanyResultSchema = z.object({
  contact: contactRefSchema.extend({
    companyName: z.string().nullable(),
  }),
  verification: z.object({
    attempted: z.literal(true),
    companyApplied: z.boolean(),
    detail: z.string().min(1),
  }),
});

export type ContactRef = z.infer<typeof contactRefSchema>;
export type ContactDetails = z.infer<typeof contactDetailsSchema>;
export type ContactsCreatePayload = z.infer<typeof contactsCreatePayloadSchema>;
export type ContactsGetDetailsPayload = z.infer<typeof contactsGetDetailsPayloadSchema>;
export type ContactsGetDetailsResult = z.infer<typeof contactsGetDetailsResultSchema>;
export type ContactsCreateSuccessResult = z.infer<typeof contactsCreateSuccessResultSchema>;
export type ContactsCreateBlockedResult = z.infer<typeof contactsCreateBlockedResultSchema>;
export type ContactsCreateResult = z.infer<typeof contactsCreateResultSchema>;
export type ContactsUpdateCompanyPayload = z.infer<typeof contactsUpdateCompanyPayloadSchema>;
export type ContactsUpdateCompanyResult = z.infer<typeof contactsUpdateCompanyResultSchema>;
