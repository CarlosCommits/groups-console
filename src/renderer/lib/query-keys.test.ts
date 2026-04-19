import { describe, expect, it } from "vitest";

import {
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
});
