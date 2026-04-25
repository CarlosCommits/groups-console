import { describe, expect, it } from "vitest";

import type { GroupsAddMembersResult, GroupsRemoveMembersResult } from "@/shared/contracts/exchange";

import {
  formatSingleRemoveMemberSuccessDescription,
  getPrimaryRemoveMemberStatus,
  getRemoveMembersIssueDescriptions,
  getRemoveMembersIssueMessage,
  hasInventoryChangingAddOutcome,
  hasInventoryChangingRemoveOutcome,
  hasMembersRefreshableAddOutcome,
  hasMembersRefreshableRemoveOutcome,
  isRemoveMemberStatusClean,
  REMOVE_MEMBER_STATUS_LABELS,
} from "./group-members-mutation-outcome";

function makeAddResult(status: GroupsAddMembersResult["items"][number]["status"]): GroupsAddMembersResult {
  return {
    group: {
      exchangeIdentity: "group-1@example.com",
      objectId: "group-1",
      groupKind: "distributionList",
    },
    summary: {
      requested: 1,
      added: status === "added" ? 1 : 0,
      alreadyMember: status === "alreadyMember" ? 1 : 0,
      invalid: status === "invalid" ? 1 : 0,
      verificationFailed: status === "verificationFailed" ? 1 : 0,
      failed: status === "failed" ? 1 : 0,
    },
    items: [
      {
        member: {
          exchangeIdentity: "member-1@example.com",
          objectId: "member-1",
          primaryEmail: "member-1@example.com",
        },
        status,
        detail: status,
      },
    ],
    verification: {
      attempted: true,
      verifiedAdded: status === "added" ? 1 : 0,
      detail: "verification",
    },
  };
}

function makeRemoveResult(status: GroupsRemoveMembersResult["items"][number]["status"]): GroupsRemoveMembersResult {
  return {
    group: {
      exchangeIdentity: "group-1@example.com",
      objectId: "group-1",
      groupKind: "distributionList",
    },
    summary: {
      requested: 1,
      removed: status === "removed" ? 1 : 0,
      notMember: status === "notMember" ? 1 : 0,
      invalid: status === "invalid" ? 1 : 0,
      verificationFailed: status === "verificationFailed" ? 1 : 0,
      failed: status === "failed" ? 1 : 0,
    },
    items: [
      {
        member: {
          exchangeIdentity: "member-1@example.com",
          objectId: "member-1",
          primaryEmail: "member-1@example.com",
        },
        status,
        detail: status,
      },
    ],
    verification: {
      attempted: true,
      verifiedRemoved: status === "removed" ? 1 : 0,
      detail: "verification",
    },
  };
}

describe("group members mutation outcomes", () => {
  it("invalidates inventory only for added members", () => {
    expect(hasInventoryChangingAddOutcome(makeAddResult("added"))).toBe(true);
    expect(hasInventoryChangingAddOutcome(makeAddResult("alreadyMember"))).toBe(false);
    expect(hasInventoryChangingAddOutcome(makeAddResult("invalid"))).toBe(false);
    expect(hasInventoryChangingAddOutcome(makeAddResult("verificationFailed"))).toBe(false);
    expect(hasInventoryChangingAddOutcome(makeAddResult("failed"))).toBe(false);
  });

  it("invalidates members query for clean add outcomes including already-member", () => {
    expect(hasMembersRefreshableAddOutcome(makeAddResult("added"))).toBe(true);
    expect(hasMembersRefreshableAddOutcome(makeAddResult("alreadyMember"))).toBe(true);
    expect(hasMembersRefreshableAddOutcome(makeAddResult("invalid"))).toBe(false);
    expect(hasMembersRefreshableAddOutcome(makeAddResult("verificationFailed"))).toBe(false);
    expect(hasMembersRefreshableAddOutcome(makeAddResult("failed"))).toBe(false);
  });

  it("invalidates inventory only for removed members", () => {
    expect(hasInventoryChangingRemoveOutcome(makeRemoveResult("removed"))).toBe(true);
    expect(hasInventoryChangingRemoveOutcome(makeRemoveResult("notMember"))).toBe(false);
    expect(hasInventoryChangingRemoveOutcome(makeRemoveResult("invalid"))).toBe(false);
    expect(hasInventoryChangingRemoveOutcome(makeRemoveResult("verificationFailed"))).toBe(false);
    expect(hasInventoryChangingRemoveOutcome(makeRemoveResult("failed"))).toBe(false);
  });

  it("invalidates members query for clean remove outcomes including not-member", () => {
    expect(hasMembersRefreshableRemoveOutcome(makeRemoveResult("removed"))).toBe(true);
    expect(hasMembersRefreshableRemoveOutcome(makeRemoveResult("notMember"))).toBe(true);
    expect(hasMembersRefreshableRemoveOutcome(makeRemoveResult("invalid"))).toBe(false);
    expect(hasMembersRefreshableRemoveOutcome(makeRemoveResult("verificationFailed"))).toBe(false);
    expect(hasMembersRefreshableRemoveOutcome(makeRemoveResult("failed"))).toBe(false);
  });

  it("classifies clean remove statuses for shared UI handling", () => {
    expect(isRemoveMemberStatusClean("removed")).toBe(true);
    expect(isRemoveMemberStatusClean("notMember")).toBe(true);
    expect(isRemoveMemberStatusClean("invalid")).toBe(false);
    expect(isRemoveMemberStatusClean("verificationFailed")).toBe(false);
    expect(isRemoveMemberStatusClean("failed")).toBe(false);
  });

  it("formats shared remove status labels and issue messages", () => {
    expect(REMOVE_MEMBER_STATUS_LABELS.removed).toBe("Removed");
    expect(getRemoveMembersIssueMessage(makeRemoveResult("failed"))).toBe(
      "member-1@example.com: Failed: failed",
    );
    expect(getRemoveMembersIssueDescriptions(makeRemoveResult("verificationFailed"))).toEqual([
      "member-1@example.com: Verification failed - verificationFailed",
    ]);
    expect(getRemoveMembersIssueMessage(makeRemoveResult("removed"))).toBeNull();
  });

  it("returns primary remove statuses and success descriptions", () => {
    expect(getPrimaryRemoveMemberStatus(makeRemoveResult("notMember"), "failed")).toBe("notMember");
    expect(formatSingleRemoveMemberSuccessDescription(
      "Test Member",
      "Test Group",
      makeRemoveResult("removed"),
    )).toBe("Test Member was removed from Test Group");
    expect(formatSingleRemoveMemberSuccessDescription(
      "Test Member",
      "Test Group",
      makeRemoveResult("notMember"),
    )).toBe("Test Member was not a member of Test Group");
    expect(formatSingleRemoveMemberSuccessDescription(
      "Test Member",
      "Test Group",
      makeRemoveResult("failed"),
    )).toBe("Test Member was not removed from Test Group");
  });
});
