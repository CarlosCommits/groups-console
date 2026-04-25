import type { GroupsAddMembersResult, GroupsRemoveMembersResult } from "@/shared/contracts/exchange";

export const REMOVE_MEMBER_STATUS_LABELS: Record<
  GroupsRemoveMembersResult["items"][number]["status"],
  string
> = {
  removed: "Removed",
  notMember: "Not a member",
  invalid: "Invalid",
  verificationFailed: "Verification failed",
  failed: "Failed",
};

export function hasInventoryChangingAddOutcome(result: GroupsAddMembersResult): boolean {
  return result.items.some((item) => item.status === "added");
}

export function hasMembersRefreshableAddOutcome(result: GroupsAddMembersResult): boolean {
  return result.items.some((item) => item.status === "added" || item.status === "alreadyMember");
}

export function hasInventoryChangingRemoveOutcome(result: GroupsRemoveMembersResult): boolean {
  return result.items.some((item) => item.status === "removed");
}

export function hasMembersRefreshableRemoveOutcome(result: GroupsRemoveMembersResult): boolean {
  return result.items.some((item) => item.status === "removed" || item.status === "notMember");
}

export function isRemoveMemberStatusClean(
  status: GroupsRemoveMembersResult["items"][number]["status"],
): boolean {
  return status === "removed" || status === "notMember";
}

export function getPrimaryRemoveMemberStatus(
  result: GroupsRemoveMembersResult,
  fallback: GroupsRemoveMembersResult["items"][number]["status"],
): GroupsRemoveMembersResult["items"][number]["status"] {
  return result.items[0]?.status ?? fallback;
}

export function getRemoveMembersIssueMessage(result: GroupsRemoveMembersResult): string | null {
  const issue = result.items.find((item) => !isRemoveMemberStatusClean(item.status));
  if (!issue) {
    return null;
  }

  const label = issue.member.primaryEmail ?? issue.member.exchangeIdentity;
  return `${label}: ${REMOVE_MEMBER_STATUS_LABELS[issue.status]}: ${issue.detail}`;
}

export function getRemoveMembersIssueDescriptions(result: GroupsRemoveMembersResult): string[] {
  return result.items
    .filter((item) => !isRemoveMemberStatusClean(item.status))
    .map((item) => {
      const label = item.member.primaryEmail ?? item.member.exchangeIdentity;
      return `${label}: ${REMOVE_MEMBER_STATUS_LABELS[item.status]} - ${item.detail}`;
    });
}

export function formatSingleRemoveMemberSuccessDescription(
  memberName: string,
  groupName: string,
  result: GroupsRemoveMembersResult,
): string {
  const status = getPrimaryRemoveMemberStatus(result, "removed");

  if (status === "removed") {
    return `${memberName} was removed from ${groupName}`;
  }

  if (status === "notMember") {
    return `${memberName} was not a member of ${groupName}`;
  }

  return `${memberName} was not removed from ${groupName}`;
}
