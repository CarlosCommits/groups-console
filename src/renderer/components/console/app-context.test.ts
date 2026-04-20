import { describe, expect, it } from "vitest";

import type { ExchangeConnectionStatus } from "@/shared/contracts/exchange";
import type { GraphConnectionStatus } from "@/shared/contracts/graph";
import type { ProgressEvent } from "@/shared/contracts/command";

import {
  applyMembershipMatrixProgress,
  createGeneratingMembershipMatrixState,
  createMembershipMatrixErrorState,
  createMembershipMatrixSuccessState,
  getShellConnectionBoundary,
  initialMembershipMatrixGenerationState,
  type ShellState,
} from "./app-context";

function makeExchangeConnection(
  overrides: Partial<ExchangeConnectionStatus> = {},
): ExchangeConnectionStatus {
  return {
    state: "connected",
    detail: "Connected to Exchange.",
    runtime: null,
    userPrincipalName: "admin@example.com",
    connectionId: "exchange-connection-a",
    tenantId: "tenant-a",
    tokenStatus: null,
    tokenExpiryTimeUtc: null,
    connectedAtUtc: null,
    ...overrides,
  };
}

function makeGraphConnection(overrides: Partial<GraphConnectionStatus> = {}): GraphConnectionStatus {
  return {
    state: "connected",
    detail: "Connected to Graph.",
    authMethod: "interactiveBrowser",
    configuredTenantId: "tenant-a",
    tenantId: "tenant-a",
    tenantDisplayName: "Tenant A",
    accountUsername: "admin@example.com",
    accountDisplayName: "Admin User",
    tokenExpiresOnUtc: null,
    exchangeAlignment: "matched",
    ...overrides,
  };
}

function makeShell(overrides: Partial<ShellState> = {}): ShellState {
  return {
    session: null,
    exchangeCapabilities: null,
    graphConnection: null,
    exchangeConnection: null,
    isHydrating: false,
    loadError: null,
    ...overrides,
  };
}

describe("getShellConnectionBoundary", () => {
  it("does not change when only descriptive fields change", () => {
    const previous = makeShell({
      exchangeConnection: makeExchangeConnection(),
      graphConnection: makeGraphConnection(),
    });
    const next = makeShell({
      exchangeConnection: makeExchangeConnection({
        detail: "Connected and healthy.",
        tokenStatus: "fresh",
      }),
      graphConnection: makeGraphConnection({
        detail: "Connected after refresh.",
        tenantDisplayName: "Tenant A Renamed",
      }),
    });

    expect(getShellConnectionBoundary(next)).toBe(getShellConnectionBoundary(previous));
  });

  it("changes when the Exchange connection identity changes", () => {
    const previous = makeShell({
      exchangeConnection: makeExchangeConnection({ connectionId: "exchange-connection-a" }),
    });
    const next = makeShell({
      exchangeConnection: makeExchangeConnection({ connectionId: "exchange-connection-b" }),
    });

    expect(getShellConnectionBoundary(next)).not.toBe(getShellConnectionBoundary(previous));
  });

  it("changes when the Graph account boundary changes", () => {
    const previous = makeShell({
      graphConnection: makeGraphConnection({ accountUsername: "admin-a@example.com" }),
    });
    const next = makeShell({
      graphConnection: makeGraphConnection({ accountUsername: "admin-b@example.com" }),
    });

    expect(getShellConnectionBoundary(next)).not.toBe(getShellConnectionBoundary(previous));
  });
});

describe("membership matrix generation state", () => {
  it("creates the expected generating state", () => {
    expect(createGeneratingMembershipMatrixState("distributionList")).toEqual({
      requestedKind: "distributionList",
      phase: "generating",
      progressMessage: "Starting…",
      progressPercent: 0,
      result: null,
      error: null,
    });
  });

  it("applies progress updates without losing existing percent when omitted", () => {
    const progressEvent: ProgressEvent = {
      requestId: "req-1",
      phase: "executing",
      message: "Reading members.",
      percent: 42,
    };

    const next = applyMembershipMatrixProgress(
      createGeneratingMembershipMatrixState("mailEnabledSecurityGroup"),
      progressEvent,
    );
    expect(next).toEqual({
      requestedKind: "mailEnabledSecurityGroup",
      phase: "generating",
      progressMessage: "Reading members.",
      progressPercent: 42,
      result: null,
      error: null,
    });

    const withoutPercent = applyMembershipMatrixProgress(next, {
      requestId: "req-1",
      phase: "verifying",
      message: "Building workbook.",
    });

    expect(withoutPercent.progressPercent).toBe(42);
    expect(withoutPercent.progressMessage).toBe("Building workbook.");
  });

  it("creates terminal success and error states", () => {
    const successState = createMembershipMatrixSuccessState({
      appliedKind: "distributionList",
      outputPath: "C:/Reports/membership-matrix.xlsx",
      generatedAt: "2026-04-20T02:00:00.000Z",
      summary: {
        groupCount: 2,
        recipientCount: 5,
        membershipCount: 8,
      },
    }, "distributionList");

    expect(successState).toEqual({
      requestedKind: "distributionList",
      phase: "success",
      progressMessage: "",
      progressPercent: 100,
      result: {
        appliedKind: "distributionList",
        outputPath: "C:/Reports/membership-matrix.xlsx",
        generatedAt: "2026-04-20T02:00:00.000Z",
        summary: {
          groupCount: 2,
          recipientCount: 5,
          membershipCount: 8,
        },
      },
      error: null,
    });

    expect(createMembershipMatrixErrorState("Report generation failed.", "all")).toEqual({
      requestedKind: "all",
      phase: "error",
      progressMessage: "",
      progressPercent: 0,
      result: null,
      error: "Report generation failed.",
    });
  });

  it("keeps idle state fully cleared", () => {
    expect(initialMembershipMatrixGenerationState).toEqual({
      requestedKind: null,
      phase: "idle",
      progressMessage: "",
      progressPercent: 0,
      result: null,
      error: null,
    });
  });
});
