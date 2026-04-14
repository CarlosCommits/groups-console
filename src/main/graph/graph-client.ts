import { z } from 'zod';

import type {
  GuestSearchItem,
  GuestsInvitePayload,
  GuestsInviteResult,
  GuestsSearchPayload,
  GuestsSearchResult,
  GuestsUpdateCompanyPayload,
  GuestsUpdateCompanyResult,
} from '@/shared/contracts/guests';
import type { RecipientConflictRecord } from '@/shared/contracts/conflicts';

const graphOrganizationSchema = z.object({
  value: z.array(
    z.object({
      id: z.string().min(1),
      displayName: z.string().nullable().optional(),
    }),
  ),
});

const graphMeSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().nullable().optional(),
  userPrincipalName: z.string().min(1),
});

const graphUserSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().nullable().optional(),
  userPrincipalName: z.string().nullable().optional(),
  mail: z.string().nullable().optional(),
  otherMails: z.array(z.string()).optional(),
  companyName: z.string().nullable().optional(),
  externalUserState: z.string().nullable().optional(),
  userType: z.string().nullable().optional(),
});

const graphUsersResponseSchema = z.object({
  value: z.array(graphUserSchema),
  '@odata.nextLink': z.string().url().optional(),
});

const graphInvitationResponseSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  inviteRedeemUrl: z.string().url().nullable().optional(),
  invitedUser: z.object({
    id: z.string().min(1),
    displayName: z.string().nullable().optional(),
    userPrincipalName: z.string().nullable().optional(),
  }),
});

type GraphUser = z.infer<typeof graphUserSchema>;

export async function fetchGraphOrganization(
  accessToken: string,
): Promise<{ id: string; displayName: string | null }> {
  const payload = graphOrganizationSchema.parse(
    await graphFetchJson('https://graph.microsoft.com/v1.0/organization?$select=id,displayName', accessToken),
  );
  const organization = payload.value[0];

  if (!organization) {
    throw new Error('Microsoft Graph did not return an organization profile.');
  }

  return {
    id: organization.id,
    displayName: organization.displayName ?? null,
  };
}

export async function fetchGraphMe(
  accessToken: string,
): Promise<{ id: string; displayName: string | null; userPrincipalName: string }> {
  const payload = graphMeSchema.parse(
    await graphFetchJson(
      'https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName',
      accessToken,
    ),
  );

  return {
    id: payload.id,
    displayName: payload.displayName ?? null,
    userPrincipalName: payload.userPrincipalName,
  };
}

export async function searchGraphGuests(
  accessToken: string,
  payload: GuestsSearchPayload,
): Promise<GuestsSearchResult> {
  const appliedLimit = payload.limit ?? 25;
  const encodedFilter = encodeURIComponent("userType eq 'Guest'");
  const query = payload.query.trim().toLowerCase();
  let nextLink = `https://graph.microsoft.com/v1.0/users?$filter=${encodedFilter}&$select=id,displayName,userPrincipalName,mail,otherMails,companyName,externalUserState&$top=${Math.min(Math.max(appliedLimit, 25), 100)}`;
  const items: GuestsSearchResult['items'] = [];

  while (nextLink && items.length < appliedLimit) {
    const result = graphUsersResponseSchema.parse(await graphFetchJson(nextLink, accessToken));

    for (const user of result.value) {
      if (!matchesGuestQuery(user, query)) {
        continue;
      }

      items.push(mapGraphUserToGuestSearchItem(user));

      if (items.length >= appliedLimit) {
        break;
      }
    }

    nextLink = result['@odata.nextLink'] ?? '';
  }

  return {
    query: payload.query.trim(),
    appliedLimit,
    items,
  };
}

export async function getGraphGuestById(
  accessToken: string,
  guestObjectId: string,
): Promise<GuestSearchItem> {
  const payload = graphUserSchema.parse(
    await graphFetchJson(
      `https://graph.microsoft.com/v1.0/users/${guestObjectId}?$select=id,displayName,userPrincipalName,mail,otherMails,companyName,externalUserState,userType`,
      accessToken,
    ),
  );

  if (payload.userType !== 'Guest') {
    throw new Error(`Graph object '${guestObjectId}' is not a guest user.`);
  }

  return mapGraphUserToGuestSearchItem(payload);
}

export async function findGraphGuestByEmail(
  accessToken: string,
  email: string,
): Promise<RecipientConflictRecord | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const escapedEmail = normalizedEmail.replace(/'/g, "''");
  const encodedFilter = encodeURIComponent(
    `userType eq 'Guest' and (mail eq '${escapedEmail}' or otherMails/any(x:x eq '${escapedEmail}'))`,
  );
  const payload = graphUsersResponseSchema.parse(
    await graphFetchJson(
      `https://graph.microsoft.com/v1.0/users?$filter=${encodedFilter}&$select=id,displayName,userPrincipalName,mail,otherMails,companyName,externalUserState&$top=10`,
      accessToken,
    ),
  );
  const exactMatch = payload.value.find((user) => getGraphUserEmailCandidates(user).includes(normalizedEmail));

  if (!exactMatch) {
    return null;
  }

  const alternateEmails = Array.from(new Set(getGraphUserEmailCandidates(exactMatch)));

  return {
    source: 'graph',
    recipientType: 'guestUser',
    objectId: exactMatch.id,
    exchangeIdentity: null,
    userPrincipalName: exactMatch.userPrincipalName ?? null,
    displayName:
      exactMatch.displayName ?? exactMatch.mail ?? exactMatch.userPrincipalName ?? normalizedEmail,
    primaryEmail: exactMatch.mail?.toLowerCase() ?? normalizedEmail,
    alternateEmails,
  };
}

function normalizeExternalUserState(
  externalUserState: string | null | undefined,
): 'PendingAcceptance' | 'Accepted' | 'unknown' {
  if (externalUserState === 'PendingAcceptance' || externalUserState === 'Accepted') {
    return externalUserState;
  }

  return 'unknown';
}

export async function inviteGraphGuest(
  accessToken: string,
  payload: GuestsInvitePayload,
  inviteRedirectUrl: string,
): Promise<GuestsInviteResult> {
  const invitation = graphInvitationResponseSchema.parse(
    await graphFetchJson(
      'https://graph.microsoft.com/v1.0/invitations',
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          invitedUserEmailAddress: payload.email,
          inviteRedirectUrl,
          invitedUserDisplayName: payload.displayName,
          sendInvitationMessage: payload.sendInvitationMessage ?? false,
        }),
      },
    ),
  );

  let companyUpdate = {
    attempted: false,
    updated: false,
    detail: 'No company update was requested.',
  };
  let appliedCompanyName: string | null = null;

  if (payload.companyName) {
    try {
      const updateResult = await updateGraphGuestCompany(accessToken, {
        guestUserId: invitation.invitedUser.id,
        companyName: payload.companyName,
      });

      companyUpdate = {
        attempted: true,
        updated: updateResult.verification.companyApplied,
        detail: updateResult.verification.detail,
      };
      appliedCompanyName = updateResult.verification.companyApplied ? updateResult.companyName : null;
    } catch (error) {
      companyUpdate = {
        attempted: true,
        updated: false,
        detail:
          error instanceof Error
            ? error.message
            : 'Guest company update failed after the invitation was created.',
      };
    }
  }

  try {
    const verifiedGuest = graphUserSchema.parse(
      await graphFetchJson(
        `https://graph.microsoft.com/v1.0/users/${invitation.invitedUser.id}?$select=id,displayName,userPrincipalName,mail,otherMails,companyName,externalUserState`,
        accessToken,
      ),
    );

    return {
      outcome: 'invited',
      invitationId: invitation.id,
      invitedUserId: invitation.invitedUser.id,
      invitedUserEmail: payload.email,
      invitedUserDisplayName: verifiedGuest.displayName ?? invitation.invitedUser.displayName ?? null,
      invitedUserUserPrincipalName:
        verifiedGuest.userPrincipalName ?? invitation.invitedUser.userPrincipalName ?? null,
      companyName: verifiedGuest.companyName ?? appliedCompanyName,
      inviteRedeemUrl: invitation.inviteRedeemUrl ?? null,
      status: invitation.status,
      companyUpdate,
      verification: {
        attempted: true,
        foundGuest: true,
        detail: 'Verified invited guest in Microsoft Graph.',
      },
    };
  } catch {
    return {
      outcome: 'invited',
      invitationId: invitation.id,
      invitedUserId: invitation.invitedUser.id,
      invitedUserEmail: payload.email,
      invitedUserDisplayName: invitation.invitedUser.displayName ?? null,
      invitedUserUserPrincipalName: invitation.invitedUser.userPrincipalName ?? null,
      companyName: appliedCompanyName,
      inviteRedeemUrl: invitation.inviteRedeemUrl ?? null,
      status: invitation.status,
      companyUpdate,
      verification: {
        attempted: true,
        foundGuest: false,
        detail: 'Invitation succeeded, but the follow-up guest read did not complete yet.',
      },
    };
  }
}

export async function updateGraphGuestCompany(
  accessToken: string,
  payload: GuestsUpdateCompanyPayload,
): Promise<GuestsUpdateCompanyResult> {
  await graphFetchJson(`https://graph.microsoft.com/v1.0/users/${payload.guestUserId}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify({
      companyName: payload.companyName,
    }),
  });

  try {
    const verifiedGuest = graphUserSchema.parse(
      await graphFetchJson(
        `https://graph.microsoft.com/v1.0/users/${payload.guestUserId}?$select=id,companyName`,
        accessToken,
      ),
    );

    return {
      guestUserId: payload.guestUserId,
      companyName: verifiedGuest.companyName ?? null,
      verification: {
        attempted: true,
        foundGuest: true,
        companyApplied: verifiedGuest.companyName === payload.companyName,
        detail:
          verifiedGuest.companyName === payload.companyName
            ? 'Verified guest company update.'
            : 'Guest update succeeded, but verification did not match the requested company value.',
      },
    };
  } catch {
    return {
      guestUserId: payload.guestUserId,
      companyName: null,
      verification: {
        attempted: true,
        foundGuest: false,
        companyApplied: false,
        detail: 'Guest company update was attempted, but verification could not read the guest user.',
      },
    };
  }
}

function matchesGuestQuery(user: GraphUser, query: string): boolean {
  const candidates = [user.displayName ?? '', ...getGraphUserEmailCandidates(user)].map((value) =>
    value.toLowerCase(),
  );

  return candidates.some((value) => value.includes(query));
}

function mapGraphUserToGuestSearchItem(user: GraphUser): GuestSearchItem {
  return {
    stableKey: `graph:objectId:${user.id}`,
    objectId: user.id,
    displayName: user.displayName ?? null,
    primaryEmail: user.mail ?? user.otherMails?.[0] ?? null,
    userPrincipalName: user.userPrincipalName ?? null,
    companyName: user.companyName ?? null,
    externalUserState: normalizeExternalUserState(user.externalUserState),
  };
}

function getGraphUserEmailCandidates(user: GraphUser): string[] {
  return [user.mail ?? '', user.userPrincipalName ?? '', ...(user.otherMails ?? [])]
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

async function graphFetchJson(
  url: string,
  accessToken: string,
  init?: RequestInit,
): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Microsoft Graph request failed with ${response.status} ${response.statusText}.`);
  }

  return (await response.json()) as unknown;
}
