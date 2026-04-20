import { describe, expect, it } from "vitest";

import type { RecipientSearchItem } from "@/shared/contracts/recipients";

import { toGroupMemberSelectionRef } from "./group-member-selection";

function makeRecipient(overrides: Partial<RecipientSearchItem> = {}): RecipientSearchItem {
  return {
    source: "exchange",
    stableKey: "exchange:objectId:recipient-1",
    recipientType: "mailbox",
    membershipSupport: "exchangeDirect",
    objectId: "recipient-1",
    exchangeIdentity: "jane@example.com",
    primaryEmail: "jane@example.com",
    displayName: "Jane Example",
    alias: "jexample",
    recipientTypeDetails: "UserMailbox",
    companyName: "Example Corp",
    companySource: "exchange",
    ...overrides,
  };
}

describe("toGroupMemberSelectionRef", () => {
  it("maps exchange-backed recipients into exchange membership selections", () => {
    expect(toGroupMemberSelectionRef(makeRecipient())).toEqual({
      kind: "exchangeRecipient",
      exchangeIdentity: "jane@example.com",
      objectId: "recipient-1",
      primaryEmail: "jane@example.com",
      displayName: "Jane Example",
    });
  });

  it("maps graph-bridgeable guests into graph guest membership selections", () => {
    expect(
      toGroupMemberSelectionRef(
        makeRecipient({
          source: "graph",
          stableKey: "graph:objectId:guest-1",
          recipientType: "guestUser",
          membershipSupport: "graphBridgeable",
          objectId: "00000000-0000-0000-0000-000000000001",
          exchangeIdentity: null,
          primaryEmail: "guest@example.com",
          alias: null,
          recipientTypeDetails: "Accepted",
          companyName: null,
          companySource: "none",
        }),
      ),
    ).toEqual({
      kind: "graphGuest",
      objectId: "00000000-0000-0000-0000-000000000001",
      primaryEmail: "guest@example.com",
      displayName: "Jane Example",
    });
  });

  it("returns null for recipients that cannot be turned into membership selections", () => {
    expect(
      toGroupMemberSelectionRef(
        makeRecipient({
          membershipSupport: "unsupported",
          exchangeIdentity: null,
        }),
      ),
    ).toBeNull();
  });

  it("returns null when an exchange-direct recipient is missing its Exchange identity", () => {
    expect(
      toGroupMemberSelectionRef(
        makeRecipient({
          exchangeIdentity: null,
        }),
      ),
    ).toBeNull();
  });
});
