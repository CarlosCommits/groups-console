import { describe, expect, it } from "vitest";

import type { ShellState } from "./app-context";
import { deriveAttentionItems, countReadyChecks } from "./dashboard-attention";

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

describe("deriveAttentionItems", () => {
  it("returns empty array when everything is healthy", () => {
    const shell = makeShell({
      graphConnection: makeGraph(),
      exchangeConnection: makeExchange(),
      session: makeSession({
        checks: [
          { id: "powershell", label: "PowerShell", status: "ready", detail: "Available" },
          { id: "exchangeModule", label: "Exchange Module", status: "ready", detail: "Available" },
        ],
      }),
    });
    expect(deriveAttentionItems(shell)).toEqual([]);
  });

  it("returns load error item when shell has loadError", () => {
    const shell = makeShell({ loadError: "Something broke" });
    const items = deriveAttentionItems(shell);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      id: "load-error",
      severity: "error",
      title: "Shell state failed to load",
      description: "Something broke",
    });
  });

  it("returns error item when graph state is error", () => {
    const shell = makeShell({
      graphConnection: makeGraph({ state: "error", detail: "Auth failed" }),
    });
    const items = deriveAttentionItems(shell);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("graph-error");
    expect(items[0].severity).toBe("error");
  });

  it("returns info item when graph is disconnected", () => {
    const shell = makeShell({
      graphConnection: makeGraph({ state: "disconnected", detail: "Not connected", exchangeAlignment: "unknown" }),
    });
    const items = deriveAttentionItems(shell);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("graph-disconnected");
    expect(items[0].severity).toBe("info");
  });

  it("returns warning item when exchangeAlignment is mismatched", () => {
    const shell = makeShell({
      graphConnection: makeGraph({ exchangeAlignment: "mismatched" }),
      exchangeConnection: makeExchange(),
    });
    const items = deriveAttentionItems(shell);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("graph-tenant-mismatch");
    expect(items[0].severity).toBe("warning");
  });

  it("returns error item when exchange state is error", () => {
    const shell = makeShell({
      exchangeConnection: makeExchange({ state: "error", detail: "Token expired" }),
    });
    const items = deriveAttentionItems(shell);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("exchange-error");
    expect(items[0].severity).toBe("error");
  });

  it("returns info item when exchange is disconnected", () => {
    const shell = makeShell({
      exchangeConnection: makeExchange({ state: "disconnected", detail: "Not connected" }),
    });
    const items = deriveAttentionItems(shell);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("exchange-disconnected");
    expect(items[0].severity).toBe("info");
  });

  it("returns warning items for missing session checks", () => {
    const shell = makeShell({
      session: makeSession({
        checks: [
          { id: "powershell", label: "PowerShell", status: "ready", detail: "Available" },
          { id: "exchangeModule", label: "Exchange Module", status: "missing", detail: "Not installed" },
        ],
      }),
    });
    const items = deriveAttentionItems(shell);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("check-missing-exchangeModule");
    expect(items[0].severity).toBe("warning");
  });

  it("returns warning items for warning session checks", () => {
    const shell = makeShell({
      session: makeSession({
        checks: [
          { id: "logDirectory", label: "Log Directory", status: "warning", detail: "Read-only" },
        ],
      }),
    });
    const items = deriveAttentionItems(shell);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("check-warning-logDirectory");
    expect(items[0].severity).toBe("warning");
  });

  it("accumulates multiple attention items", () => {
    const shell = makeShell({
      loadError: "Partial load failure",
      graphConnection: makeGraph({ state: "error", detail: "Auth failed", exchangeAlignment: "unknown" }),
      exchangeConnection: makeExchange({ state: "disconnected", detail: "Not connected" }),
      session: makeSession({
        checks: [
          { id: "powershell", label: "PowerShell", status: "warning", detail: "Old version" },
          { id: "tenantConfig", label: "Tenant Config", status: "missing", detail: "Not configured" },
        ],
      }),
    });
    const items = deriveAttentionItems(shell);
    expect(items.length).toBeGreaterThanOrEqual(4);
    const ids = items.map((i) => i.id);
    expect(ids).toContain("load-error");
    expect(ids).toContain("graph-error");
    expect(ids).toContain("exchange-disconnected");
    expect(ids).toContain("check-warning-powershell");
    expect(ids).toContain("check-missing-tenantConfig");
  });

  it("does not produce duplicate items for graph error and disconnected simultaneously", () => {
    const shell = makeShell({
      graphConnection: makeGraph({ state: "error", detail: "Failed", exchangeAlignment: "unknown" }),
    });
    const items = deriveAttentionItems(shell);
    const graphItems = items.filter((i) => i.id.startsWith("graph-"));
    // error state should produce graph-error, not graph-disconnected
    expect(graphItems).toHaveLength(1);
    expect(graphItems[0].id).toBe("graph-error");
  });
});

describe("countReadyChecks", () => {
  it("returns 0/0 when session is null", () => {
    const shell = makeShell();
    expect(countReadyChecks(shell)).toEqual({ ready: 0, total: 0 });
  });

  it("returns 0/0 when session has no checks", () => {
    const shell = makeShell({ session: makeSession() });
    expect(countReadyChecks(shell)).toEqual({ ready: 0, total: 0 });
  });

  it("counts ready checks correctly", () => {
    const shell = makeShell({
      session: makeSession({
        checks: [
          { id: "powershell", label: "PowerShell", status: "ready", detail: "Available" },
          { id: "exchangeModule", label: "Exchange Module", status: "ready", detail: "Available" },
          { id: "logDirectory", label: "Log Directory", status: "warning", detail: "Read-only" },
          { id: "tenantConfig", label: "Tenant Config", status: "missing", detail: "Not configured" },
        ],
      }),
    });
    expect(countReadyChecks(shell)).toEqual({ ready: 2, total: 4 });
  });

  it("returns all ready when all checks pass", () => {
    const shell = makeShell({
      session: makeSession({
        checks: [
          { id: "powershell", label: "PowerShell", status: "ready", detail: "Available" },
          { id: "exchangeModule", label: "Exchange Module", status: "ready", detail: "Available" },
        ],
      }),
    });
    expect(countReadyChecks(shell)).toEqual({ ready: 2, total: 2 });
  });
});