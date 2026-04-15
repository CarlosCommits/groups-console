import { describe, it, expect } from "vitest";
import {
  deriveCapabilityRows,
  deriveCoverageSummary,
} from "./reports-coverage";
import type { CapabilityStatus } from "./reports-coverage";
import type { ShellState } from "./app-context";
import type { SessionStatusSchema } from "@/shared/contracts/session";
import type { ExchangeCapabilities, ExchangeConnectionStatus } from "@/shared/contracts/exchange";
import type { GraphConnectionStatus } from "@/shared/contracts/graph";

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

function makeSession(
  checks: SessionStatusSchema["checks"] = [],
): SessionStatusSchema {
  return {
    appVersion: "0.0.0-test",
    environment: "development",
    checks,
    security: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  };
}

function makeExchangeConnection(
  state: ExchangeConnectionStatus["state"] = "disconnected",
  overrides: Partial<ExchangeConnectionStatus> = {},
): ExchangeConnectionStatus {
  return {
    state,
    detail: state === "connected" ? "Connected" : "Not connected",
    runtime: null,
    userPrincipalName: state === "connected" ? "admin@example.com" : null,
    connectionId: null,
    tenantId: null,
    tokenStatus: null,
    tokenExpiryTimeUtc: null,
    connectedAtUtc: null,
    ...overrides,
  };
}

function makeGraphConnection(
  state: GraphConnectionStatus["state"] = "disconnected",
  overrides: Partial<GraphConnectionStatus> = {},
): GraphConnectionStatus {
  return {
    state,
    detail: state === "connected" ? "Connected" : "Not connected",
    authMethod: state === "connected" ? "interactiveBrowser" : null,
    configuredTenantId: null,
    tenantId: state === "connected" ? "tenant-1" : null,
    tenantDisplayName: null,
    accountUsername: state === "connected" ? "admin@example.com" : null,
    accountDisplayName: state === "connected" ? "Admin User" : null,
    tokenExpiresOnUtc: null,
    exchangeAlignment: "unknown",
    ...overrides,
  };
}

function makeCapabilities(
  overrides: Partial<ExchangeCapabilities> = {},
): ExchangeCapabilities {
  return {
    status: "ready",
    detail: "Ready",
    runtime: null,
    exchangeModule: {
      installed: true,
      importable: true,
      version: "3.0.0",
      moduleBase: null,
      importError: null,
      commandChecks: {
        connectExchangeOnline: true,
        disconnectExchangeOnline: true,
        getConnectionInformation: true,
      },
    },
    ...overrides,
  };
}

describe("deriveCapabilityRows", () => {
  it("returns unavailable rows when shell is empty", () => {
    const shell = makeShell();
    const rows = deriveCapabilityRows(shell);

    expect(rows).toHaveLength(7);
    expect(rows.find((r) => r.id === "shell-bootstrap")?.status).toBe("unavailable");
    expect(rows.find((r) => r.id === "exchange-connection")?.status).toBe("unavailable");
    expect(rows.find((r) => r.id === "graph-connection")?.status).toBe("unavailable");
    expect(rows.find((r) => r.id === "group-inventory")?.status).toBe("unavailable");
    expect(rows.find((r) => r.id === "guest-contact-workflows")?.status).toBe("unavailable");
    expect(rows.find((r) => r.id === "report-export")?.status).toBe("unavailable");
    expect(rows.find((r) => r.id === "audit-observability")?.status).toBe("deferred");
  });

  it("marks bootstrap as available when all checks are ready", () => {
    const shell = makeShell({
      session: makeSession([
        { id: "powershell", label: "PowerShell", status: "ready", detail: "OK" },
        { id: "exchangeModule", label: "Exchange Module", status: "ready", detail: "OK" },
      ]),
    });
    const rows = deriveCapabilityRows(shell);
    expect(rows.find((r) => r.id === "shell-bootstrap")?.status).toBe("available");
  });

  it("marks bootstrap as partial when some checks are ready", () => {
    const shell = makeShell({
      session: makeSession([
        { id: "powershell", label: "PowerShell", status: "ready", detail: "OK" },
        { id: "exchangeModule", label: "Exchange Module", status: "missing", detail: "Not found" },
      ]),
    });
    const rows = deriveCapabilityRows(shell);
    expect(rows.find((r) => r.id === "shell-bootstrap")?.status).toBe("partial");
  });

  it("marks exchange and group inventory as available when connected", () => {
    const shell = makeShell({
      exchangeConnection: makeExchangeConnection("connected"),
    });
    const rows = deriveCapabilityRows(shell);
    expect(rows.find((r) => r.id === "exchange-connection")?.status).toBe("available");
    expect(rows.find((r) => r.id === "group-inventory")?.status).toBe("available");
  });

  it("marks graph and guest/contact as available when connected", () => {
    const shell = makeShell({
      graphConnection: makeGraphConnection("connected"),
    });
    const rows = deriveCapabilityRows(shell);
    expect(rows.find((r) => r.id === "graph-connection")?.status).toBe("available");
    expect(rows.find((r) => r.id === "guest-contact-workflows")?.status).toBe("available");
  });

  it("marks report-export as available when Exchange is connected", () => {
    const shell = makeShell({
      session: makeSession([
        { id: "powershell", label: "PowerShell", status: "ready", detail: "OK" },
      ]),
      exchangeCapabilities: makeCapabilities(),
      exchangeConnection: makeExchangeConnection("connected"),
      graphConnection: makeGraphConnection("connected"),
    });
    const rows = deriveCapabilityRows(shell);
    expect(rows.find((r) => r.id === "report-export")?.status).toBe("available");
    expect(rows.find((r) => r.id === "audit-observability")?.status).toBe("deferred");
  });

  it("includes user principal name in exchange detail when connected", () => {
    const shell = makeShell({
      exchangeConnection: makeExchangeConnection("connected", {
        userPrincipalName: "jdoe@contoso.com",
      }),
    });
    const rows = deriveCapabilityRows(shell);
    expect(rows.find((r) => r.id === "exchange-connection")?.detail).toContain(
      "jdoe@contoso.com",
    );
  });

  it("includes error detail when exchange has error state", () => {
    const shell = makeShell({
      exchangeConnection: makeExchangeConnection("error", {
        detail: "Auth token expired",
      }),
    });
    const rows = deriveCapabilityRows(shell);
    expect(rows.find((r) => r.id === "exchange-connection")?.detail).toBe(
      "Auth token expired",
    );
  });
});

describe("deriveCoverageSummary", () => {
  it("counts available, deferred, and total correctly", () => {
    const rows = [
      { id: "a", surface: "A", status: "available" as CapabilityStatus, detail: "" },
      { id: "b", surface: "B", status: "partial" as CapabilityStatus, detail: "" },
      { id: "c", surface: "C", status: "deferred" as CapabilityStatus, detail: "" },
      { id: "d", surface: "D", status: "unavailable" as CapabilityStatus, detail: "" },
    ];
    const summary = deriveCoverageSummary(rows);
    expect(summary.available).toBe(1);
    expect(summary.deferred).toBe(1);
    expect(summary.total).toBe(4);
  });

  it("returns zeros for empty rows", () => {
    const summary = deriveCoverageSummary([]);
    expect(summary.available).toBe(0);
    expect(summary.deferred).toBe(0);
    expect(summary.total).toBe(0);
  });
});
