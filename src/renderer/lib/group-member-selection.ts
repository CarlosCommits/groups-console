import type { GroupMemberSelectionRef } from "@/shared/contracts/exchange";
import type { RecipientSearchItem } from "@/shared/contracts/recipients";

export function toGroupMemberSelectionRef(
  candidate: RecipientSearchItem,
): GroupMemberSelectionRef | null {
  if (candidate.membershipSupport === "graphBridgeable" && candidate.objectId !== null) {
    return {
      kind: "graphGuest",
      objectId: candidate.objectId,
      primaryEmail: candidate.primaryEmail,
      displayName: candidate.displayName,
    };
  }

  if (candidate.membershipSupport === "exchangeDirect" && candidate.exchangeIdentity !== null) {
    return {
      kind: "exchangeRecipient",
      exchangeIdentity: candidate.exchangeIdentity,
      objectId: candidate.objectId,
      primaryEmail: candidate.primaryEmail,
      displayName: candidate.displayName,
    };
  }

  return null;
}
