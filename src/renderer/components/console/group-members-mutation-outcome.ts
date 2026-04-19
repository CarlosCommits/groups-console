import type { GroupsAddMembersResult, GroupsRemoveMembersResult } from "@/shared/contracts/exchange";

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
