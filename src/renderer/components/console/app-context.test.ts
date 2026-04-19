import { describe, expect, it } from "vitest";

import type { ExchangeConnectionStatus } from "@/shared/contracts/exchange";
import type { GraphConnectionStatus } from "@/shared/contracts/graph";

import { getShellConnectionBoundary, type ShellState } from "./app-context";

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
