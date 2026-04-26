import { z } from 'zod';

import { recipientConflictSchema } from './conflicts';

export const guestExternalUserStateSchema = z.enum([
  'PendingAcceptance',
  'Accepted',
  'unknown',
]);

export const guestsSearchPayloadSchema = z
  .object({
    query: z.string().trim().min(2).max(256),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict();

export const guestsGetDetailsPayloadSchema = z
  .object({
    stableKey: z.string().min(1),
  })
  .strict();

export const guestSearchItemSchema = z.object({
  stableKey: z.string().min(1),
  objectId: z.string().min(1),
  displayName: z.string().nullable(),
  primaryEmail: z.string().nullable(),
  userPrincipalName: z.string().nullable(),
  companyName: z.string().nullable(),
  externalUserState: guestExternalUserStateSchema,
});

export const guestDetailsSchema = guestSearchItemSchema.extend({
  givenName: z.string().nullable(),
  surname: z.string().nullable(),
  jobTitle: z.string().nullable(),
  department: z.string().nullable(),
  mobilePhone: z.string().nullable(),
  officeLocation: z.string().nullable(),
  preferredLanguage: z.string().nullable(),
  createdDateTime: z.string().datetime().nullable(),
  accountEnabled: z.boolean().nullable(),
});

export const guestsGetDetailsResultSchema = z.object({
  guest: guestDetailsSchema,
});

export const guestsSearchResultSchema = z.object({
  query: z.string().min(2),
  appliedLimit: z.number().int().min(1).max(100),
  items: z.array(guestSearchItemSchema),
});

export const guestsInvitePayloadSchema = z
  .object({
    email: z.string().email(),
    displayName: z.string().trim().min(1).max(256).optional(),
    companyName: z.string().trim().min(1).max(64).optional(),
    jobTitle: z.string().trim().min(1).max(128).optional(),
    department: z.string().trim().min(1).max(128).optional(),
    officeLocation: z.string().trim().min(1).max(128).optional(),
    mobilePhone: z.string().trim().min(1).max(64).optional(),
    sendInvitationMessage: z.boolean().optional(),
    invitationMessage: z.string().trim().min(1).max(1000).optional(),
    invitationCcEmail: z.string().email().optional(),
  })
  .strict();

export const guestsInviteSuccessResultSchema = z.object({
  outcome: z.literal('invited'),
  invitationId: z.string().min(1),
  invitedUserId: z.string().min(1),
  invitedUserEmail: z.string().email(),
  invitedUserDisplayName: z.string().nullable(),
  invitedUserUserPrincipalName: z.string().nullable(),
  companyName: z.string().nullable(),
  inviteRedeemUrl: z.string().url().nullable(),
  status: z.string().min(1),
  companyUpdate: z.object({
    attempted: z.boolean(),
    updated: z.boolean(),
    detail: z.string().min(1),
  }),
  verification: z.object({
    attempted: z.literal(true),
    foundGuest: z.boolean(),
    detail: z.string().min(1),
  }),
});

export const guestsInviteBlockedResultSchema = z.object({
  outcome: z.literal('blockedConflict'),
  conflict: recipientConflictSchema.extend({
    action: z.literal('guests.invite'),
  }),
});

export const guestsInviteResultSchema = z.discriminatedUnion('outcome', [
  guestsInviteSuccessResultSchema,
  guestsInviteBlockedResultSchema,
]);

export const guestsUpdateCompanyPayloadSchema = z
  .object({
    guestUserId: z.string().min(1),
    companyName: z.string().trim().max(64),
  })
  .strict();

export const guestsUpdateCompanyResultSchema = z.object({
  guestUserId: z.string().min(1),
  companyName: z.string().nullable(),
  verification: z.object({
    attempted: z.literal(true),
    foundGuest: z.boolean(),
    companyApplied: z.boolean(),
    detail: z.string().min(1),
  }),
});

export type GuestsSearchPayload = z.infer<typeof guestsSearchPayloadSchema>;
export type GuestSearchItem = z.infer<typeof guestSearchItemSchema>;
export type GuestDetails = z.infer<typeof guestDetailsSchema>;
export type GuestsSearchResult = z.infer<typeof guestsSearchResultSchema>;
export type GuestsGetDetailsPayload = z.infer<typeof guestsGetDetailsPayloadSchema>;
export type GuestsGetDetailsResult = z.infer<typeof guestsGetDetailsResultSchema>;
export type GuestsInvitePayload = z.infer<typeof guestsInvitePayloadSchema>;
export type GuestsInviteSuccessResult = z.infer<typeof guestsInviteSuccessResultSchema>;
export type GuestsInviteBlockedResult = z.infer<typeof guestsInviteBlockedResultSchema>;
export type GuestsInviteResult = z.infer<typeof guestsInviteResultSchema>;
export type GuestsUpdateCompanyPayload = z.infer<typeof guestsUpdateCompanyPayloadSchema>;
export type GuestsUpdateCompanyResult = z.infer<typeof guestsUpdateCompanyResultSchema>;
