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
});
