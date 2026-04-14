import { z } from 'zod';

import { recipientSearchSourceSchema, recipientSearchTypeSchema } from './recipients';

export const recipientConflictActionSchema = z.enum(['contacts.create', 'guests.invite']);

export const recipientConflictCategorySchema = z.enum([
  'emailAlreadyOwned',
  'guestContactOverlap',
  'tenantMismatch',
  'eventualConsistencyDelay',
  'preflightUnavailable',
]);

export const recipientConflictRecordSchema = z
  .object({
    source: recipientSearchSourceSchema,
    recipientType: recipientSearchTypeSchema,
    objectId: z.string().nullable(),
    exchangeIdentity: z.string().nullable(),
    userPrincipalName: z.string().nullable(),
    displayName: z.string().min(1),
    primaryEmail: z.string().email().nullable(),
    alternateEmails: z.array(z.string().email()),
  })
  .strict();

export const recipientConflictSchema = z
  .object({
    action: recipientConflictActionSchema,
    category: recipientConflictCategorySchema,
    blocking: z.literal(true),
    targetEmail: z.string().email(),
    message: z.string().min(1),
    guidance: z.string().min(1),
    records: z.array(recipientConflictRecordSchema),
  })
  .strict();

export const recipientConflictLookupResultSchema = z
  .object({
    targetEmail: z.string().email(),
    records: z.array(recipientConflictRecordSchema),
  })
  .strict();

export type RecipientConflictAction = z.infer<typeof recipientConflictActionSchema>;
export type RecipientConflictCategory = z.infer<typeof recipientConflictCategorySchema>;
export type RecipientConflictRecord = z.infer<typeof recipientConflictRecordSchema>;
export type RecipientConflict = z.infer<typeof recipientConflictSchema>;
export type RecipientConflictLookupResult = z.infer<typeof recipientConflictLookupResultSchema>;
