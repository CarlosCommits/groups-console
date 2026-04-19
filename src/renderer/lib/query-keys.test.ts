import { describe, expect, it } from "vitest";

import {
  getExchangeConnectionIdentity,
  disconnectedConnectionScope,
  normalizeConnectionScope,
  queryKeyNamespace,
  queryKeys,
} from "./query-keys";

describe("query keys", () => {
  it("uses the shared application namespace", () => {
    expect(queryKeys.all()).toEqual([queryKeyNamespace]);
  });

  it("normalizes missing connection identity to the disconnected scope", () => {
    expect(normalizeConnectionScope()).toBe(disconnectedConnectionScope);
    expect(normalizeConnectionScope("   ")).toBe(disconnectedConnectionScope);
  });

  it("preserves non-empty connection identity", () => {
    expect(normalizeConnectionScope("tenant-a")).toBe("tenant-a");
  });

  it("builds exchange keys with the connection segment before resource parts", () => {
    expect(queryKeys.scoped("exchange", "tenant-a", "groups", { kind: "distributionList" })).toEqual([
      queryKeyNamespace,
      "exchange",
      "tenant-a",
      "groups",
      { kind: "distributionList" },
    ]);
  });

  it("builds graph root keys with a normalized disconnected scope", () => {
    expect(queryKeys.graphRoot()).toEqual([
      queryKeyNamespace,
      "graph",
      disconnectedConnectionScope,
    ]);
  });

  it("builds exchange root keys with the provided connection identity", () => {
    expect(queryKeys.exchangeRoot("tenant-a")).toEqual([
      queryKeyNamespace,
      "exchange",
      "tenant-a",
    ]);
  });

  it("builds the exchange connection identity from boundary fields only", () => {
    expect(
      getExchangeConnectionIdentity({
        state: "connected",
        tenantId: "tenant-a",
        connectionId: "exchange-connection-a",
        userPrincipalName: "admin@example.com",
      }),
    ).toBe("connected:tenant-a:exchange-connection-a:admin@example.com");
  });

  it("builds exchange groups root keys under the shared exchange scope", () => {
    expect(queryKeys.exchangeGroupsRoot("tenant-a")).toEqual([
      queryKeyNamespace,
      "exchange",
      "tenant-a",
      "groups",
    ]);
  });

  it("builds exchange groups list keys under the shared exchange scope", () => {
    expect(queryKeys.exchangeGroupsList("tenant-a")).toEqual([
      queryKeyNamespace,
      "exchange",
      "tenant-a",
      "groups",
      "list",
    ]);
  });

  it("builds exchange group members root keys under the shared exchange scope", () => {
    expect(queryKeys.exchangeGroupMembersRoot("tenant-a")).toEqual([
      queryKeyNamespace,
      "exchange",
      "tenant-a",
      "groups",
      "members",
    ]);
  });

  it("builds exchange group members list keys under the shared exchange scope", () => {
    expect(queryKeys.exchangeGroupMembersList("tenant-a", "group-1@example.com")).toEqual([
      queryKeyNamespace,
      "exchange",
      "tenant-a",
      "groups",
      "members",
      "group-1@example.com",
    ]);
  });

  it("builds recipients search root keys under the recipients scope", () => {
    expect(queryKeys.recipientsSearchRoot("tenant-a")).toEqual([
      queryKeyNamespace,
      "recipients",
      "tenant-a",
      "search",
    ]);
  });

  it("builds recipients search keys with query and types", () => {
    expect(queryKeys.recipientsSearch("tenant-a", "john", ["mailbox", "mailContact"])).toEqual([
      queryKeyNamespace,
      "recipients",
      "tenant-a",
      "search",
      "john",
      "mailbox,mailContact",
    ]);
  });

  it("builds contact details keys with stable key identity", () => {
    expect(queryKeys.contactDetails("tenant-a", "exchange:objectId:mailContact:123")).toEqual([
      queryKeyNamespace,
      "contacts",
      "tenant-a",
      "details",
      "exchange:objectId:mailContact:123",
    ]);
  });

  it("builds guest details keys with stable key identity", () => {
    expect(queryKeys.guestDetails("tenant-a", "graph:objectId:abc-123")).toEqual([
      queryKeyNamespace,
      "guests",
      "tenant-a",
      "details",
      "graph:objectId:abc-123",
    ]);
  });

  it("builds exchange recipient details keys with stable key identity", () => {
    expect(queryKeys.exchangeRecipientDetails("tenant-a", "exchange:objectId:mailbox:456")).toEqual([
      queryKeyNamespace,
      "exchange",
      "tenant-a",
      "recipient-details",
      "exchange:objectId:mailbox:456",
    ]);
  });

  it("isolates recipients search keys by connection identity", () => {
    const keyA = queryKeys.recipientsSearch("connected:tenant-a:conn-a:admin@example.com", "john", ["mailbox"]);
    const keyB = queryKeys.recipientsSearch("connected:tenant-b:conn-b:admin@example.com", "john", ["mailbox"]);
    expect(keyA).not.toEqual(keyB);
  });

  it("isolates detail keys by connection identity", () => {
    const keyA = queryKeys.contactDetails("connected:tenant-a:conn-a:admin@example.com", "sk-1");
    const keyB = queryKeys.contactDetails("connected:tenant-b:conn-b:admin@example.com", "sk-1");
    expect(keyA).not.toEqual(keyB);
  });
});
