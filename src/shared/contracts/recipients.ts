import { z } from 'zod';

export const recipientSearchSourceSchema = z.enum(['exchange', 'graph']);
export const recipientSearchTypeSchema = z.enum([
  'mailbox',
  'mailContact',
  'mailUser',
  'distributionList',
  'mailEnabledSecurityGroup',
  'guestUser',
  'unknown',
]);
export const recipientMembershipSupportSchema = z.enum([
  'exchangeDirect',
  'graphDeferred',
  'unsupported',
]);
export const recipientCompanySourceSchema = z.enum(['exchange', 'graph', 'none']);
export const recipientSearchSourceStatusSchema = z.enum([
  'searched',
  'skipped',
  'deferred',
  'unavailable',
]);

export const recipientsSearchPayloadSchema = z
  .object({
    query: z.string().trim().min(2).max(256),
    limit: z.number().int().min(1).max(100).optional(),
    types: z.array(recipientSearchTypeSchema).min(1).optional(),
  })
  .strict();

export const recipientSearchItemSchema = z.object({
  source: recipientSearchSourceSchema,
  stableKey: z.string().min(1),
  recipientType: recipientSearchTypeSchema,
  membershipSupport: recipientMembershipSupportSchema,
  objectId: z.string().nullable(),
  exchangeIdentity: z.string().nullable(),
  primaryEmail: z.string().nullable(),
  displayName: z.string().min(1),
  alias: z.string().nullable(),
  recipientTypeDetails: z.string().nullable(),
  companyName: z.string().nullable(),
  companySource: recipientCompanySourceSchema,
});

export const recipientsSearchResultSchema = z.object({
  query: z.string().min(2),
  appliedLimit: z.number().int().min(1).max(100),
  appliedTypes: z.array(recipientSearchTypeSchema),
  sourceStatus: z.object({
    exchange: recipientSearchSourceStatusSchema,
    graph: recipientSearchSourceStatusSchema,
  }),
  items: z.array(recipientSearchItemSchema),
});

export type RecipientsSearchPayload = z.infer<typeof recipientsSearchPayloadSchema>;
export type RecipientSearchItem = z.infer<typeof recipientSearchItemSchema>;
export type RecipientsSearchResult = z.infer<typeof recipientsSearchResultSchema>;
