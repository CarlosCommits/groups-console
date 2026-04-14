import type {
  GroupMemberSelectionRef,
  GroupMemberWriteRef,
  GroupsAddMembersPayload,
  GroupsAddMembersResult,
  ResolvedGroupsAddMembersPayload,
} from '@/shared/contracts/exchange';

import { resolveRecipientForMembership } from '@/main/recipients/resolve-recipient-for-membership';

import { exchangeSessionManager } from './exchange-session-manager';

export async function addGroupMembers(
  payload: GroupsAddMembersPayload,
): Promise<GroupsAddMembersResult> {
  const resolutionResults = await Promise.all(
    payload.members.map(async (member) => ({
      requested: member,
      resolution: await resolveRecipientForMembership(member),
    })),
  );

  const readyMembers: GroupMemberWriteRef[] = [];
  const invalidItems: GroupsAddMembersResult['items'] = [];

  resolutionResults.forEach(({ requested, resolution }) => {
    if (resolution.kind === 'exchangeDirect') {
      readyMembers.push(resolution.member);
      return;
    }

    invalidItems.push({
      member: toFallbackWriteRef(requested),
      status: 'invalid',
      detail: resolution.reason,
    });
  });

  if (readyMembers.length === 0) {
    return buildNoOpAddMembersResult(payload, invalidItems);
  }

  const exchangeResult = await exchangeSessionManager.addMembers({
    group: payload.group,
    members: readyMembers,
    verify: payload.verify,
  } satisfies ResolvedGroupsAddMembersPayload);

  return mergeAddMembersResults(payload, exchangeResult, invalidItems);
}

function toFallbackWriteRef(member: GroupMemberSelectionRef): GroupMemberWriteRef {
  if (member.kind === 'exchangeRecipient') {
    return {
      exchangeIdentity: member.exchangeIdentity,
      objectId: member.objectId,
      primaryEmail: member.primaryEmail,
    };
  }

  return {
    exchangeIdentity: member.primaryEmail ?? member.objectId,
    objectId: member.objectId,
    primaryEmail: member.primaryEmail,
  };
}

function buildNoOpAddMembersResult(
  payload: GroupsAddMembersPayload,
  invalidItems: GroupsAddMembersResult['items'],
): GroupsAddMembersResult {
  return {
    group: payload.group,
    summary: {
      requested: payload.members.length,
      added: 0,
      alreadyMember: 0,
      invalid: invalidItems.length,
      verificationFailed: 0,
      failed: 0,
    },
    items: invalidItems,
    verification: {
      attempted: true,
      verifiedAdded: 0,
      detail: 'No membership writes were attempted because no selected recipients could be resolved to Exchange membership targets.',
    },
  };
}

function mergeAddMembersResults(
  payload: GroupsAddMembersPayload,
  exchangeResult: GroupsAddMembersResult,
  invalidItems: GroupsAddMembersResult['items'],
): GroupsAddMembersResult {
  return {
    group: exchangeResult.group,
    summary: {
      requested: payload.members.length,
      added: exchangeResult.summary.added,
      alreadyMember: exchangeResult.summary.alreadyMember,
      invalid: exchangeResult.summary.invalid + invalidItems.length,
      verificationFailed: exchangeResult.summary.verificationFailed,
      failed: exchangeResult.summary.failed,
    },
    items: [...exchangeResult.items, ...invalidItems],
    verification: {
      attempted: true,
      verifiedAdded: exchangeResult.verification.verifiedAdded,
      detail:
        invalidItems.length > 0
          ? `${exchangeResult.verification.detail} ${invalidItems.length} selected recipient(s) were not submitted because they could not be resolved to Exchange membership targets.`
          : exchangeResult.verification.detail,
    },
  };
}
