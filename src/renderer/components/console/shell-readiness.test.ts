import { describe, expect, it } from "vitest";

import type { ShellState } from "./app-context";
import { deriveShellReadiness, deriveAuthSetupStep } from "./shell-readiness";

import type { GraphConnectionStatus } from "@/shared/contracts/graph";
import type { ExchangeConnectionStatus } from "@/shared/contracts/exchange";
import type { SessionStatusSchema } from "@/shared/contracts/session";

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

function makeGraph(overrides: Partial<GraphConnectionStatus> = {}): GraphConnectionStatus {
  return {
    state: "connected",
    detail: "Connected.",
    authMethod: "interactiveBrowser",
    configuredTenantId: "tenant-1",
    tenantId: "tenant-1",
    tenantDisplayName: "Example Tenant",
    accountUsername: "admin@example.com",
    accountDisplayName: "Admin Example",
    tokenExpiresOnUtc: "2026-04-02T00:00:00.000Z",
    exchangeAlignment: "matched",
    ...overrides,
  };
}

function makeExchange(overrides: Partial<ExchangeConnectionStatus> = {}): ExchangeConnectionStatus {
  return {
    state: "connected",
    detail: "Connected.",
    runtime: null,
    userPrincipalName: "admin@example.com",
    connectionId: "conn-1",
    tenantId: "tenant-1",
    tokenStatus: "active",
    tokenExpiryTimeUtc: "2026-04-02T00:00:00.000Z",
    connectedAtUtc: "2026-04-01T00:00:00.000Z",
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

describe("deriveShellReadiness", () => {
  it("returns signedOut when neither service is connected", () => {
    const shell = makeShell({
      graphConnection: makeGraph({ state: "disconnected", exchangeAlignment: "unknown" }),
      exchangeConnection: makeExchange({ state: "disconnected" }),
    });
    const result = deriveShellReadiness(shell);
    expect(result.readiness).toBe("signedOut");
    expect(result.graphConnected).toBe(false);
    expect(result.exchangeActive).toBe(false);
  });

  it("returns signedOut when both connections are null", () => {
    const shell = makeShell();
    const result = deriveShellReadiness(shell);
    expect(result.readiness).toBe("signedOut");
  });

  it("returns partial when Graph is connected but Exchange is not", () => {
    const shell = makeShell({
      graphConnection: makeGraph(),
      exchangeConnection: makeExchange({ state: "disconnected" }),
    });
    const result = deriveShellReadiness(shell);
    expect(result.readiness).toBe("partial");
    expect(result.graphConnected).toBe(true);
    expect(result.exchangeActive).toBe(false);
  });

  it("returns partial when Exchange is connected but Graph is not", () => {
    const shell = makeShell({
      graphConnection: makeGraph({ state: "disconnected", exchangeAlignment: "unknown" }),
      exchangeConnection: makeExchange(),
    });
    const result = deriveShellReadiness(shell);
    expect(result.readiness).toBe("partial");
  });

  it("returns partial when both connected but exchangeAlignment is mismatched", () => {
    const shell = makeShell({
      graphConnection: makeGraph({ exchangeAlignment: "mismatched" }),
      exchangeConnection: makeExchange(),
    });
    const result = deriveShellReadiness(shell);
    expect(result.readiness).toBe("partial");
  });

  it("returns partial when both connected but exchangeAlignment is unknown", () => {
    const shell = makeShell({
      graphConnection: makeGraph({ exchangeAlignment: "unknown" }),
      exchangeConnection: makeExchange(),
    });
    const result = deriveShellReadiness(shell);
    expect(result.readiness).toBe("partial");
  });

  it("returns ready when both connected and exchangeAlignment is matched", () => {
    const shell = makeShell({
      graphConnection: makeGraph(),
      exchangeConnection: makeExchange(),
    });
    const result = deriveShellReadiness(shell);
    expect(result.readiness).toBe("ready");
    expect(result.graphConnected).toBe(true);
    expect(result.exchangeActive).toBe(true);
  });

  it("returns partial when Graph is in error state and Exchange is disconnected", () => {
    const shell = makeShell({
      graphConnection: makeGraph({ state: "error", exchangeAlignment: "unknown" }),
      exchangeConnection: makeExchange({ state: "disconnected" }),
    });
    const result = deriveShellReadiness(shell);
    expect(result.readiness).toBe("partial");
  });

  it("derives displayName from graph accountDisplayName first", () => {
    const shell = makeShell({
      graphConnection: makeGraph({
        accountDisplayName: "Display Name",
        accountUsername: "admin@example.com",
      }),
      exchangeConnection: makeExchange({ userPrincipalName: "admin@example.com" }),
    });
    const result = deriveShellReadiness(shell);
    expect(result.displayName).toBe("Display Name");
  });

  it("falls back to graph accountUsername when displayName is null", () => {
    const shell = makeShell({
      graphConnection: makeGraph({
        accountDisplayName: null,
        accountUsername: "admin@example.com",
      }),
      exchangeConnection: makeExchange({ userPrincipalName: "admin@example.com" }),
    });
    const result = deriveShellReadiness(shell);
    expect(result.displayName).toBe("admin@example.com");
  });

  it("falls back to exchange userPrincipalName when graph fields are null", () => {
    const shell = makeShell({
      graphConnection: makeGraph({
        state: "disconnected",
        accountDisplayName: null,
        accountUsername: null,
        exchangeAlignment: "unknown",
      }),
      exchangeConnection: makeExchange({ userPrincipalName: "exchange@example.com" }),
    });
    const result = deriveShellReadiness(shell);
    expect(result.displayName).toBe("exchange@example.com");
  });

  it("falls back to 'Not connected' when all displayName sources are null", () => {
    const shell = makeShell();
    const result = deriveShellReadiness(shell);
    expect(result.displayName).toBe("Not connected");
  });

  it("derives secondaryLine from graph accountUsername first", () => {
    const shell = makeShell({
      graphConnection: makeGraph({ accountUsername: "admin@example.com" }),
      exchangeConnection: makeExchange({ userPrincipalName: "exchange@example.com" }),
      session: makeSession({ environment: "production" }),
    });
    const result = deriveShellReadiness(shell);
    expect(result.secondaryLine).toBe("admin@example.com");
  });

  it("falls back to exchange userPrincipalName for secondaryLine", () => {
    const shell = makeShell({
      graphConnection: makeGraph({ state: "disconnected", accountUsername: null, exchangeAlignment: "unknown" }),
      exchangeConnection: makeExchange({ userPrincipalName: "exchange@example.com" }),
      session: makeSession({ environment: "production" }),
    });
    const result = deriveShellReadiness(shell);
    expect(result.secondaryLine).toBe("exchange@example.com");
  });

  it("falls back to session environment for secondaryLine", () => {
    const shell = makeShell({
      graphConnection: makeGraph({ state: "disconnected", accountUsername: null, exchangeAlignment: "unknown" }),
      exchangeConnection: makeExchange({ state: "disconnected", userPrincipalName: null }),
      session: makeSession({ environment: "production" }),
    });
    const result = deriveShellReadiness(shell);
    expect(result.secondaryLine).toBe("production");
  });

  it("falls back to 'No active session' when all secondaryLine sources are null", () => {
    const shell = makeShell();
    const result = deriveShellReadiness(shell);
    expect(result.secondaryLine).toBe("No active session");
  });

  it("includes setupStep in deriveShellReadiness result", () => {
    const shell = makeShell({
      graphConnection: makeGraph(),
      exchangeConnection: makeExchange(),
    });
    const result = deriveShellReadiness(shell);
    expect(result.setupStep).toBe("ready");
  });
});

describe("deriveAuthSetupStep", () => {
  it("returns graphNeeded when neither service is connected", () => {
    const shell = makeShell({
      graphConnection: makeGraph({ state: "disconnected", exchangeAlignment: "unknown" }),
      exchangeConnection: makeExchange({ state: "disconnected" }),
    });
    expect(deriveAuthSetupStep(shell)).toBe("graphNeeded");
  });

  it("returns graphNeeded when both connections are null", () => {
    const shell = makeShell();
    expect(deriveAuthSetupStep(shell)).toBe("graphNeeded");
  });

  it("returns graphNeeded when Graph is in error state", () => {
    const shell = makeShell({
      graphConnection: makeGraph({ state: "error", exchangeAlignment: "unknown" }),
      exchangeConnection: makeExchange({ state: "disconnected" }),
    });
    expect(deriveAuthSetupStep(shell)).toBe("graphNeeded");
  });

  it("returns exchangeNeeded when Graph is connected but Exchange is disconnected", () => {
    const shell = makeShell({
      graphConnection: makeGraph(),
      exchangeConnection: makeExchange({ state: "disconnected" }),
    });
    expect(deriveAuthSetupStep(shell)).toBe("exchangeNeeded");
  });

  it("returns exchangeNeeded when Graph is connected but Exchange is in error state", () => {
    const shell = makeShell({
      graphConnection: makeGraph(),
      exchangeConnection: makeExchange({ state: "error" }),
    });
    expect(deriveAuthSetupStep(shell)).toBe("exchangeNeeded");
  });

  it("returns mismatched when both connected but exchangeAlignment is mismatched", () => {
    const shell = makeShell({
      graphConnection: makeGraph({ exchangeAlignment: "mismatched" }),
      exchangeConnection: makeExchange(),
    });
    expect(deriveAuthSetupStep(shell)).toBe("mismatched");
  });

  it("returns mismatched when both connected but exchangeAlignment is unknown", () => {
    const shell = makeShell({
      graphConnection: makeGraph({ exchangeAlignment: "unknown" }),
      exchangeConnection: makeExchange(),
    });
    expect(deriveAuthSetupStep(shell)).toBe("mismatched");
  });

  it("returns ready when both connected and exchangeAlignment is matched", () => {
    const shell = makeShell({
      graphConnection: makeGraph(),
      exchangeConnection: makeExchange(),
    });
    expect(deriveAuthSetupStep(shell)).toBe("ready");
  });

  it("returns graphNeeded when Exchange is connected but Graph is disconnected", () => {
    const shell = makeShell({
      graphConnection: makeGraph({ state: "disconnected", exchangeAlignment: "unknown" }),
      exchangeConnection: makeExchange(),
    });
    expect(deriveAuthSetupStep(shell)).toBe("graphNeeded");
  });
});