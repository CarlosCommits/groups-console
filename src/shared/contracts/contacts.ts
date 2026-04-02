import { z } from 'zod';

export const contactRefSchema = z
  .object({
    exchangeIdentity: z.string().min(1),
    objectId: z.string().nullable(),
    primaryEmail: z.string().email().nullable(),
  })
  .strict();

export const contactsCreatePayloadSchema = z
  .object({
    firstName: z.string().trim().min(1).max(128),
    lastName: z.string().trim().min(1).max(128),
    email: z.string().email(),
    companyName: z.string().trim().min(1).max(256),
  })
  .strict();

export const contactsCreateResultSchema = z.object({
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

export const contactsUpdateCompanyPayloadSchema = z
  .object({
    exchangeIdentity: z.string().min(1),
    companyName: z.string().trim().min(1).max(256),
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
export type ContactsCreatePayload = z.infer<typeof contactsCreatePayloadSchema>;
export type ContactsCreateResult = z.infer<typeof contactsCreateResultSchema>;
export type ContactsUpdateCompanyPayload = z.infer<typeof contactsUpdateCompanyPayloadSchema>;
export type ContactsUpdateCompanyResult = z.infer<typeof contactsUpdateCompanyResultSchema>;
