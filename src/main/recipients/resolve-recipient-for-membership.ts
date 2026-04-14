import type { GroupMemberSelectionRef, GroupMemberWriteRef } from '@/shared/contracts/exchange';

import { getExchangeConnectionStatus } from '@/main/exchange/get-exchange-connection-status';
import { exchangeSessionManager } from '@/main/exchange/exchange-session-manager';
import { getGraphConnectionStatus } from '@/main/graph/get-graph-connection-status';
import { graphSessionManager } from '@/main/graph/graph-session-manager';

export type MembershipRecipientResolution =
  | {
      kind: 'exchangeDirect';
      member: GroupMemberWriteRef;
    }
  | {
      kind: 'graphDeferred';
      reason: string;
    }
  | {
      kind: 'unsupported';
      reason: string;
    };

export async function resolveRecipientForMembership(
  candidate: GroupMemberSelectionRef,
): Promise<MembershipRecipientResolution> {
  if (candidate.kind === 'exchangeRecipient') {
    return {
      kind: 'exchangeDirect',
      member: {
        exchangeIdentity: candidate.exchangeIdentity,
        objectId: candidate.objectId,
        primaryEmail: candidate.primaryEmail,
      },
    };
  }

  const [exchangeStatus, graphStatus] = await Promise.all([
    getExchangeConnectionStatus(),
    getGraphConnectionStatus(),
  ]);

  if (exchangeStatus.state !== 'connected') {
    return {
      kind: 'graphDeferred',
      reason: 'Exchange Online must be connected before a guest can be resolved for membership.',
    };
  }

  if (graphStatus.state !== 'connected') {
    return {
      kind: 'graphDeferred',
      reason: 'Microsoft Graph must be connected before a guest can be resolved for membership.',
    };
  }

  if (graphStatus.exchangeAlignment !== 'matched') {
    return {
      kind: 'graphDeferred',
      reason:
        graphStatus.exchangeAlignment === 'mismatched'
          ? 'Microsoft Graph must match the current Exchange tenant before a guest can be resolved for membership.'
          : 'The app must verify Microsoft Graph and Exchange tenant alignment before a guest can be resolved for membership.',
    };
  }

  try {
    const guest = await graphSessionManager.getGuestById(candidate.objectId);
    const target = await exchangeSessionManager.resolveGuestMailUserByObjectId(
      guest.objectId,
      guest.primaryEmail,
    );

    if (!target.resolved || !target.member) {
      return {
        kind: 'graphDeferred',
        reason: target.detail,
      };
    }

    return {
      kind: 'exchangeDirect',
      member: target.member,
    };
  } catch (error) {
    return {
      kind: 'graphDeferred',
      reason:
        error instanceof Error
          ? error.message
          : 'The selected guest could not be resolved for Exchange membership.',
    };
  }
}
