import type {
  ExchangeGroupListItem,
  ExchangeGroupRef,
  ExchangeConnectionStatus,
  GroupsGetMembershipsPayload,
  GroupsGetMembershipsResult,
  GroupsGetMembersResult,
  ResolvedGroupsGetMembershipsPayload,
} from '@/shared/contracts/exchange';

import { writeSystemLogEvent } from '@/main/logging/logger';
import { getCurrentOperationContext } from '@/main/logging/operation-context';
import { resolveRecipientForMembership } from '@/main/recipients/resolve-recipient-for-membership';

import { exchangeSessionManager } from './exchange-session-manager';
import { getExchangeConnectionStatus } from './get-exchange-connection-status';

export async function getGroupMemberships(
  payload: GroupsGetMembershipsPayload,
): Promise<GroupsGetMembershipsResult> {
  const resolution = await resolveRecipientForMembership(payload.member);

  if (resolution.kind !== 'exchangeDirect') {
    throw new Error(resolution.reason);
  }

  const resolvedPayload = {
    member: resolution.member,
  } satisfies ResolvedGroupsGetMembershipsPayload;

  try {
    return await exchangeSessionManager.getGroupMemberships(resolvedPayload);
  } catch (error) {
    if (!isMissingMembershipsCommandError(error)) {
      throw error;
    }

    try {
      const fallbackResult = await getGroupMembershipsFallback(
        resolution.member.exchangeIdentity,
        resolvedPayload,
      );
      await writeMembershipsFallbackSystemLog({
        memberExchangeIdentity: resolution.member.exchangeIdentity,
        membershipCount: fallbackResult.items.length,
        result: 'partial',
        fallbackReason: error.message,
      });

      return fallbackResult;
    } catch (fallbackError) {
      await writeMembershipsFallbackSystemLog({
        memberExchangeIdentity: resolution.member.exchangeIdentity,
        membershipCount: null,
        result: 'failed',
        fallbackReason: error.message,
      });
      throw fallbackError;
    }
  }
}

async function getGroupMembershipsFallback(
  memberExchangeIdentity: string,
  payload: ResolvedGroupsGetMembershipsPayload,
): Promise<GroupsGetMembershipsResult> {
  const groupsResult = await exchangeSessionManager.listGroups({ kind: 'all' });
  const normalizedIdentity = memberExchangeIdentity.toLowerCase();

  const memberships: ExchangeGroupListItem[] = [];

  for (const group of groupsResult.items) {
    const membersResult = await exchangeSessionManager.getGroupMembers({
      group: toExchangeGroupRef(group),
    });

    if (hasMemberIdentity(membersResult, normalizedIdentity)) {
      memberships.push(group);
    }
  }

  return {
    member: payload.member,
    items: memberships,
  };
}

function toExchangeGroupRef(group: ExchangeGroupListItem): ExchangeGroupRef {
  return {
    exchangeIdentity: group.exchangeIdentity,
    objectId: group.objectId,
    groupKind: group.groupKind,
  };
}

function hasMemberIdentity(result: GroupsGetMembersResult, normalizedIdentity: string): boolean {
  return result.items.some((member) => {
    const candidates = [member.exchangeIdentity, member.primaryEmail, member.alias]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.toLowerCase());

    return candidates.includes(normalizedIdentity);
  });
}

function isMissingMembershipsCommandError(error: unknown): error is Error {
  return error instanceof Error && /Invoke-RadAppGetGroupMemberships/i.test(error.message);
}

async function writeMembershipsFallbackSystemLog(input: {
  memberExchangeIdentity: string;
  membershipCount: number | null;
  result: 'partial' | 'failed';
  fallbackReason: string;
}): Promise<void> {
  const context = getCurrentOperationContext();

  if (!context) {
    return;
  }

  try {
    const exchangeStatus = await getExchangeConnectionStatus();

    await writeSystemLogEvent({
      timestamp: new Date().toISOString(),
      operationId: context.operationId,
      ipcRequestId: context.ipcRequestId,
      actorUpn: getActorUpn(exchangeStatus),
      tenantId: getTenantId(exchangeStatus),
      operationType: 'groups.getMemberships',
      targetObjectType: 'exchangeRecipient',
      targetObjectId: input.memberExchangeIdentity,
      summary:
        input.result === 'partial'
          ? `Loaded ${input.membershipCount ?? 0} group membership(s) via fallback because Invoke-RadAppGetGroupMemberships was unavailable.`
          : 'Fallback was triggered because Invoke-RadAppGetGroupMemberships was unavailable, but loading group memberships still failed.',
      result: input.result,
      authoritative: false,
    });
  } catch {
    // System-log persistence must never affect membership reads.
  }
}

function getActorUpn(status: ExchangeConnectionStatus): string | null {
  return status.state === 'connected' ? status.userPrincipalName : null;
}

function getTenantId(status: ExchangeConnectionStatus): string | null {
  return status.state === 'connected' ? status.tenantId : null;
}
