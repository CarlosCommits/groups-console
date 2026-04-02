import type { GroupMemberWriteRef } from '@/shared/contracts/exchange';
import type { RecipientSearchItem } from '@/shared/contracts/recipients';

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

export function resolveRecipientForMembership(
  candidate: RecipientSearchItem,
): MembershipRecipientResolution {
  if (candidate.membershipSupport === 'exchangeDirect' && candidate.exchangeIdentity) {
    return {
      kind: 'exchangeDirect',
      member: {
        exchangeIdentity: candidate.exchangeIdentity,
        objectId: candidate.objectId,
        primaryEmail: candidate.primaryEmail,
      },
    };
  }

  if (candidate.membershipSupport === 'graphDeferred') {
    return {
      kind: 'graphDeferred',
      reason: 'Guest membership support requires the future Graph-backed recipient resolver.',
    };
  }

  return {
    kind: 'unsupported',
    reason: 'This recipient type is not currently supported for direct membership writes.',
  };
}
