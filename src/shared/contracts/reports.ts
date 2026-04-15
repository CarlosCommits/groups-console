import { z } from 'zod';

import { exchangeGroupRefSchema } from './exchange';

export const reportGroupKindSchema = z.enum(['all', 'distributionList', 'mailEnabledSecurityGroup']);

export const reportsGenerateMembershipMatrixPayloadSchema = z
  .object({
    kind: reportGroupKindSchema.optional(),
  })
  .strict();

export const reportMembershipRowSchema = z
  .object({
    stableRecipientKey: z.string().min(1),
    source: z.enum(['exchange', 'graph']).nullable(),
    recipientType: z.string().min(1),
    recipientTypeDetails: z.string().nullable(),
    objectId: z.string().nullable(),
    exchangeIdentity: z.string().nullable(),
    displayName: z.string().min(1),
    primaryEmail: z.string().nullable(),
    companyName: z.string().nullable(),
    memberships: z.array(z.string().min(1)),
  })
  .strict();

export const reportMembershipMatrixDataSchema = z
  .object({
    appliedKind: reportGroupKindSchema,
    generatedAt: z.string().datetime(),
    groups: z.array(
      exchangeGroupRefSchema.extend({
        displayName: z.string().min(1),
        primaryEmail: z.string().nullable(),
      }),
    ),
    rows: z.array(reportMembershipRowSchema),
    summary: z.object({
      groupCount: z.number().int().nonnegative(),
      recipientCount: z.number().int().nonnegative(),
      membershipCount: z.number().int().nonnegative(),
    }),
  })
  .strict();

export const reportsGenerateMembershipMatrixResultSchema = z
  .object({
    appliedKind: reportGroupKindSchema,
    outputPath: z.string().min(1),
    generatedAt: z.string().datetime(),
    summary: z.object({
      groupCount: z.number().int().nonnegative(),
      recipientCount: z.number().int().nonnegative(),
      membershipCount: z.number().int().nonnegative(),
    }),
  })
  .strict();

export type ReportGroupKind = z.infer<typeof reportGroupKindSchema>;
export type ReportsGenerateMembershipMatrixPayload = z.infer<
  typeof reportsGenerateMembershipMatrixPayloadSchema
>;
export type ReportMembershipRow = z.infer<typeof reportMembershipRowSchema>;
export type ReportMembershipMatrixData = z.infer<typeof reportMembershipMatrixDataSchema>;
export type ReportsGenerateMembershipMatrixResult = z.infer<
  typeof reportsGenerateMembershipMatrixResultSchema
>;
