import { describe, expect, it } from "vitest";

import type { ExchangeConnectionStatus } from "@/shared/contracts/exchange";
import type { GraphConnectionStatus } from "@/shared/contracts/graph";
import type { ProgressEvent } from "@/shared/contracts/command";
import type { SessionStatusSchema } from "@/shared/contracts/session";

import {
  applyMembershipMatrixProgress,
  createGeneratingMembershipMatrixState,
  createMembershipMatrixErrorState,
  createMembershipMatrixSuccessState,
  getExchangeUpnPreset,
  deriveExchangePrerequisiteBlocker,
  resolveLastExchangeConnectFailureAfterRefresh,
  getShellConnectionBoundary,
  initialMembershipMatrixGenerationState,
  resolveAutoExchangeUpnAfterGraphConnect,
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

function makeSession(overrides: Partial<SessionStatusSchema> = {}): SessionStatusSchema {
  return {
    appVersion: "1.0.0",
    environment: "development",
    checks: [],
    security: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
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

describe("getExchangeUpnPreset", () => {
  it("prefers the Exchange connection user principal name", () => {
    const shell = makeShell({
      exchangeConnection: makeExchangeConnection({ userPrincipalName: "exchange@example.com" }),
      graphConnection: makeGraphConnection({ accountUsername: "graph@example.com" }),
    });

    expect(getExchangeUpnPreset(shell)).toBe("exchange@example.com");
  });

  it("falls back to the Graph account username when Exchange is disconnected", () => {
    const shell = makeShell({
      exchangeConnection: makeExchangeConnection({ state: "disconnected", userPrincipalName: null }),
      graphConnection: makeGraphConnection({ accountUsername: "graph@example.com" }),
    });

    expect(getExchangeUpnPreset(shell)).toBe("graph@example.com");
  });
});

describe("deriveExchangePrerequisiteBlocker", () => {
  it("blocks Exchange auth when PowerShell is missing", () => {
    const result = deriveExchangePrerequisiteBlocker(makeShell({
      session: makeSession({
        checks: [
          {
            id: "powershell",
            label: "PowerShell runtime",
            status: "missing",
            detail: "No supported PowerShell runtime executable was found.",
          },
          {
            id: "exchangeModule",
            label: "Exchange module",
            status: "missing",
            detail: "Exchange module check could not run.",
          },
        ],
      }),
    }));

    expect(result).toEqual({
      kind: "missingPowerShell",
      title: "PowerShell is required for Exchange Online",
      detail: "No supported PowerShell runtime executable was found.",
      guidance: "Install Windows PowerShell 5.1 or PowerShell 7, then restart Groups Console so the prerequisite check can run again.",
      canInstallModule: false,
    });
  });

  it("allows the app to install the Exchange module when only that prerequisite is missing", () => {
    const result = deriveExchangePrerequisiteBlocker(makeShell({
      session: makeSession({
        checks: [
          {
            id: "powershell",
            label: "PowerShell runtime",
            status: "ready",
            detail: "Detected Windows PowerShell.",
          },
          {
            id: "exchangeModule",
            label: "Exchange module",
            status: "missing",
            detail: "ExchangeOnlineManagement was not found.",
          },
        ],
      }),
    }));

    expect(result).toEqual({
      kind: "missingExchangeModule",
      title: "ExchangeOnlineManagement is required",
      detail: "ExchangeOnlineManagement was not found.",
      guidance: "Use the install button to add ExchangeOnlineManagement for the current Windows user, or have IT deploy the module to this workstation.",
      canInstallModule: true,
    });
  });

  it("blocks Exchange auth when the Exchange module is installed but not importable", () => {
    const result = deriveExchangePrerequisiteBlocker(makeShell({
      session: makeSession({
        checks: [
          {
            id: "powershell",
            label: "PowerShell runtime",
            status: "ready",
            detail: "Detected Windows PowerShell.",
          },
          {
            id: "exchangeModule",
            label: "Exchange module",
            status: "warning",
            detail: "ExchangeOnlineManagement is installed but not importable.",
          },
        ],
      }),
      exchangeCapabilities: {
        status: "warning",
        detail: "ExchangeOnlineManagement is installed but not importable.",
        runtime: {
          command: "powershell.exe",
          label: "Windows PowerShell",
          version: "5.1",
          edition: "Desktop",
        },
        exchangeModule: {
          installed: true,
          importable: false,
          version: "3.9.0",
          moduleBase: "C:/Users/Admin/Documents/WindowsPowerShell/Modules/ExchangeOnlineManagement",
          importError: "File cannot be loaded because running scripts is disabled on this system.",
          commandChecks: {
            connectExchangeOnline: false,
            disconnectExchangeOnline: false,
            getConnectionInformation: false,
          },
        },
      },
    }));

    expect(result).toEqual({
      kind: "exchangeModuleNotImportable",
      title: "ExchangeOnlineManagement could not be loaded",
      detail: "File cannot be loaded because running scripts is disabled on this system.",
      guidance: "Ask IT to review the module import failure. This is usually caused by a corrupted module install, missing dependency, or workstation security policy such as Constrained Language Mode, AppLocker, WDAC, or script-signing enforcement.",
      canInstallModule: false,
    });
  });
});

describe("resolveAutoExchangeUpnAfterGraphConnect", () => {
  it("uses the Graph account username when the user has not edited the Exchange UPN", () => {
    const graphResult = makeGraphConnection({ accountUsername: "graph@example.com" });

    expect(
      resolveAutoExchangeUpnAfterGraphConnect({
        graphResult,
        exchangeConnection: makeExchangeConnection({ state: "disconnected", userPrincipalName: null }),
        exchangeUpn: "",
        userEditedUpn: false,
      }),
    ).toBe("graph@example.com");
  });

  it("preserves a user-edited Exchange UPN for the automatic connect attempt", () => {
    const graphResult = makeGraphConnection({ accountUsername: "graph@example.com" });

    expect(
      resolveAutoExchangeUpnAfterGraphConnect({
        graphResult,
        exchangeConnection: makeExchangeConnection({ state: "disconnected", userPrincipalName: null }),
        exchangeUpn: " custom@example.com ",
        userEditedUpn: true,
      }),
    ).toBe("custom@example.com");
  });

  it("does not auto-connect Exchange when Graph did not connect", () => {
    const graphResult = makeGraphConnection({
      state: "error",
      accountUsername: "graph@example.com",
      exchangeAlignment: "unknown",
    });

    expect(
      resolveAutoExchangeUpnAfterGraphConnect({
        graphResult,
        exchangeConnection: makeExchangeConnection({ state: "disconnected", userPrincipalName: null }),
        exchangeUpn: "graph@example.com",
        userEditedUpn: false,
      }),
    ).toBeNull();
  });

  it("does not auto-connect Exchange when it is already connected", () => {
    const graphResult = makeGraphConnection({ accountUsername: "graph@example.com" });

    expect(
      resolveAutoExchangeUpnAfterGraphConnect({
        graphResult,
        exchangeConnection: makeExchangeConnection({ state: "connected" }),
        exchangeUpn: "graph@example.com",
        userEditedUpn: false,
      }),
    ).toBeNull();
  });
});

describe("resolveLastExchangeConnectFailureAfterRefresh", () => {
  it("clears the last exchange connect failure after a connected refresh", () => {
    expect(
      resolveLastExchangeConnectFailureAfterRefresh(
        "Authentication failed for admin@example.com",
        makeExchangeConnection({ state: "disconnected", userPrincipalName: null }),
        makeExchangeConnection({ state: "connected" }),
      ),
    ).toBeNull();
  });

  it("preserves the last exchange connect failure while exchange remains disconnected", () => {
    expect(
      resolveLastExchangeConnectFailureAfterRefresh(
        "Authentication failed for admin@example.com",
        makeExchangeConnection({ state: "disconnected", userPrincipalName: null }),
        makeExchangeConnection({ state: "disconnected", userPrincipalName: null }),
      ),
    ).toBe("Authentication failed for admin@example.com");
  });

  it("preserves a null last exchange connect failure during refresh", () => {
    expect(
      resolveLastExchangeConnectFailureAfterRefresh(
        null,
        makeExchangeConnection({ state: "disconnected", userPrincipalName: null }),
        makeExchangeConnection({ state: "disconnected", userPrincipalName: null }),
      ),
    ).toBeNull();
  });

  it("clears the last exchange connect failure when refresh transitions from connected to disconnected", () => {
    expect(
      resolveLastExchangeConnectFailureAfterRefresh(
        "Authentication failed for admin@example.com",
        makeExchangeConnection({ state: "connected" }),
        makeExchangeConnection({ state: "disconnected", userPrincipalName: null }),
      ),
    ).toBeNull();
  });
});
