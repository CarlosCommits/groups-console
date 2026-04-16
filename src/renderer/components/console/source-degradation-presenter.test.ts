import { describe, expect, it } from "vitest";

import type {
  RecipientSearchSourceStatus,
  RecipientsSearchResult,
} from "@/shared/contracts/recipients";
import type { CommandErrorClassification } from "@/shared/contracts/runtime-errors";

import {
  formatSourceDegradationNote,
  presentSourceDegradation,
} from "./source-degradation-presenter";

function makeSourceStatus(
  exchange: RecipientSearchSourceStatus = "searched",
  graph: RecipientSearchSourceStatus = "searched",
): RecipientsSearchResult["sourceStatus"] {
  return { exchange, graph };
}

function makeSourceFailures(
  overrides?: Partial<NonNullable<RecipientsSearchResult["sourceFailures"]>>,
): RecipientsSearchResult["sourceFailures"] {
  return overrides ?? undefined;
}

function makeClassification(overrides?: Partial<CommandErrorClassification>): CommandErrorClassification {
  return {
    category: overrides?.category ?? "connectionFailure",
    remediation: overrides?.remediation ?? "reconnect",
    backend: overrides?.backend ?? "exchange",
    operation: overrides?.operation ?? "exchange.search",
    guidance: overrides?.guidance ?? "Try reconnecting.",
  };
}

describe("presentSourceDegradation", () => {
  it("returns null when all sources searched successfully", () => {
    const result = presentSourceDegradation(makeSourceStatus("searched", "searched"));
    expect(result).toBeNull();
  });

  it("returns null when sources are searched and skipped", () => {
    const result = presentSourceDegradation(makeSourceStatus("searched", "skipped"));
    expect(result).toBeNull();
  });

  it("returns degradation note for unavailable Exchange without failures", () => {
    const result = presentSourceDegradation(
      makeSourceStatus("unavailable", "searched"),
    );
    expect(result).not.toBeNull();
    expect(result!.label).toBe("Partial results");
    expect(result!.message).toBe("Exchange unavailable");
    expect(result!.guidance).toBeNull();
    expect(result!.degradedSources).toEqual(["exchange"]);
  });

  it("returns degradation note for deferred Graph without failures", () => {
    const result = presentSourceDegradation(
      makeSourceStatus("searched", "deferred"),
    );
    expect(result).not.toBeNull();
    expect(result!.message).toBe("Graph deferred");
    expect(result!.degradedSources).toEqual(["graph"]);
  });

  it("combines multiple degraded sources", () => {
    const result = presentSourceDegradation(
      makeSourceStatus("unavailable", "deferred"),
    );
    expect(result).not.toBeNull();
    expect(result!.message).toBe("Exchange unavailable; Graph deferred");
    expect(result!.degradedSources).toEqual(["exchange", "graph"]);
  });

  it("uses classification category from sourceFailures for connection failure", () => {
    const result = presentSourceDegradation(
      makeSourceStatus("unavailable", "searched"),
      makeSourceFailures({
        exchange: {
          message: "Exchange connection lost",
          classification: makeClassification({
            category: "connectionFailure",
            remediation: "reconnect",
            guidance: "Reconnect to Exchange Online.",
          }),
        },
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.message).toBe("Exchange connection failed");
    expect(result!.guidance).toBe("Reconnect to Exchange Online.");
  });

  it("uses classification category from sourceFailures for authorization failure", () => {
    const result = presentSourceDegradation(
      makeSourceStatus("searched", "unavailable"),
      makeSourceFailures({
        graph: {
          message: "Graph authorization denied",
          classification: makeClassification({
            category: "authorizationFailure",
            remediation: "verifyPermissions",
            backend: "graph",
            guidance: "Verify Graph admin consent.",
          }),
        },
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.message).toBe("Graph authorization failed");
    expect(result!.guidance).toBe("Verify Graph admin consent.");
  });

  it("uses classification category from sourceFailures for tenant mismatch", () => {
    const result = presentSourceDegradation(
      makeSourceStatus("unavailable", "unavailable"),
      makeSourceFailures({
        graph: {
          message: "Tenant mismatch",
          classification: makeClassification({
            category: "tenantMismatch",
            remediation: "reconnectMatchedTenant",
            backend: "graph",
            guidance: "Reconnect with a matching tenant.",
          }),
        },
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.message).toBe("Exchange unavailable; Graph tenant mismatch");
    expect(result!.guidance).toBe("Reconnect with a matching tenant.");
  });

  it("falls back to remediation-based guidance when classification guidance is empty", () => {
    const result = presentSourceDegradation(
      makeSourceStatus("unavailable", "searched"),
      makeSourceFailures({
        exchange: {
          message: "Exchange auth failed",
          classification: makeClassification({
            category: "authorizationFailure",
            remediation: "verifyPermissions",
            guidance: "",
          }),
        },
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.guidance).toBe(
      "Verify that your account has the required permissions and try again.",
    );
  });

  it("combines guidance from multiple source failures", () => {
    const result = presentSourceDegradation(
      makeSourceStatus("unavailable", "unavailable"),
      makeSourceFailures({
        exchange: {
          message: "Exchange connection lost",
          classification: makeClassification({
            category: "connectionFailure",
            remediation: "reconnect",
            guidance: "Reconnect Exchange.",
          }),
        },
        graph: {
          message: "Graph auth denied",
          classification: makeClassification({
            category: "authorizationFailure",
            remediation: "verifyPermissions",
            guidance: "Verify Graph permissions.",
          }),
        },
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.message).toBe("Exchange connection failed; Graph authorization failed");
    expect(result!.guidance).toBe("Reconnect Exchange. Verify Graph permissions.");
  });

  it("uses fallback category label for unknown classification categories", () => {
    const unknownClassification = {
      category: "newCategoryNotYetKnown",
      remediation: "retryFromFreshState",
      backend: "app",
      operation: "test",
      guidance: "Retry.",
    } as unknown as CommandErrorClassification;
    const result = presentSourceDegradation(
      makeSourceStatus("unavailable", "searched"),
      makeSourceFailures({
        exchange: {
          message: "Something went wrong",
          classification: unknownClassification,
        },
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.message).toBe("Exchange unavailable");
    expect(result!.guidance).toBe("Retry.");
  });

  it("ignores sourceFailures for sources that are not degraded", () => {
    const result = presentSourceDegradation(
      makeSourceStatus("searched", "searched"),
      makeSourceFailures({
        exchange: {
          message: "Should not appear",
          classification: makeClassification({
            category: "connectionFailure",
            guidance: "Should not appear",
          }),
        },
      }),
    );
    expect(result).toBeNull();
  });

  it("uses status-based description when sourceFailures is undefined", () => {
    const result = presentSourceDegradation(
      makeSourceStatus("unavailable", "deferred"),
      undefined,
    );
    expect(result).not.toBeNull();
    expect(result!.message).toBe("Exchange unavailable; Graph deferred");
    expect(result!.guidance).toBeNull();
  });

  it("uses status-based description when sourceFailures lacks entry for a degraded source", () => {
    const result = presentSourceDegradation(
      makeSourceStatus("unavailable", "deferred"),
      makeSourceFailures({
        exchange: {
          message: "Exchange down",
          classification: makeClassification({
            category: "connectionFailure",
            guidance: "Reconnect.",
          }),
        },
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.message).toBe("Exchange connection failed; Graph deferred");
    expect(result!.guidance).toBe("Reconnect.");
  });
});

describe("formatSourceDegradationNote", () => {
  it("returns message when guidance is null", () => {
    expect(
      formatSourceDegradationNote({
        label: "Partial results",
        message: "Exchange unavailable",
        guidance: null,
        degradedSources: ["exchange"],
      }),
    ).toBe("Exchange unavailable");
  });

  it("appends guidance when present", () => {
    expect(
      formatSourceDegradationNote({
        label: "Partial results",
        message: "Exchange connection failed",
        guidance: "Try reconnecting to the service.",
        degradedSources: ["exchange"],
      }),
    ).toBe("Exchange connection failed Try reconnecting to the service.");
  });

  it("returns message unchanged when guidance duplicates it", () => {
    expect(
      formatSourceDegradationNote({
        label: "Partial results",
        message: "Exchange unavailable",
        guidance: "Exchange unavailable",
        degradedSources: ["exchange"],
      }),
    ).toBe("Exchange unavailable");
  });
});