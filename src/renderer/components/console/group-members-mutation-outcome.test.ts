import { describe, expect, it } from "vitest";

import type { GroupsAddMembersResult, GroupsRemoveMembersResult } from "@/shared/contracts/exchange";

import {
  hasInventoryChangingAddOutcome,
  hasInventoryChangingRemoveOutcome,
  hasMembersRefreshableAddOutcome,
  hasMembersRefreshableRemoveOutcome,
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
});
