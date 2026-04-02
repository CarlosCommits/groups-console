import { z } from 'zod';

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

export const guestSearchItemSchema = z.object({
  stableKey: z.string().min(1),
  objectId: z.string().min(1),
  displayName: z.string().nullable(),
  primaryEmail: z.string().nullable(),
  userPrincipalName: z.string().nullable(),
  companyName: z.string().nullable(),
  externalUserState: guestExternalUserStateSchema,
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
    sendInvitationMessage: z.boolean().optional(),
  })
  .strict();

export const guestsInviteResultSchema = z.object({
  invitationId: z.string().min(1),
  invitedUserId: z.string().min(1),
  invitedUserEmail: z.string().email(),
  invitedUserDisplayName: z.string().nullable(),
  invitedUserUserPrincipalName: z.string().nullable(),
  inviteRedeemUrl: z.string().url().nullable(),
  status: z.string().min(1),
  verification: z.object({
    attempted: z.literal(true),
    foundGuest: z.boolean(),
    detail: z.string().min(1),
  }),
});

export type GuestsSearchPayload = z.infer<typeof guestsSearchPayloadSchema>;
export type GuestSearchItem = z.infer<typeof guestSearchItemSchema>;
export type GuestsSearchResult = z.infer<typeof guestsSearchResultSchema>;
export type GuestsInvitePayload = z.infer<typeof guestsInvitePayloadSchema>;
export type GuestsInviteResult = z.infer<typeof guestsInviteResultSchema>;
