import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ShellState, PendingAction, ActionErrors } from "./app-context";
import type { AuthSetupStep } from "./shell-readiness";

import type { GraphConnectionStatus } from "@/shared/contracts/graph";
import type { ExchangeConnectionStatus } from "@/shared/contracts/exchange";

const useAppMock = vi.hoisted(() => vi.fn());

vi.mock("./app-context", () => ({
  useApp: useAppMock,
  deriveExchangePrerequisiteBlocker: (shell: ShellState) => {
    const powerShell = shell.session?.checks.find((check) => check.id === "powershell");
    if (powerShell?.status === "missing") {
      return {
        kind: "missingPowerShell",
        title: "PowerShell is required for Exchange Online",
        detail: powerShell.detail,
        guidance: "Install Windows PowerShell 5.1 or PowerShell 7, then restart Groups Console so the prerequisite check can run again.",
        canInstallModule: false,
      };
    }

    const exchangeModule = shell.session?.checks.find((check) => check.id === "exchangeModule");
    if (exchangeModule?.status === "missing") {
      return {
        kind: "missingExchangeModule",
        title: "ExchangeOnlineManagement is required",
        detail: exchangeModule.detail,
        guidance: "Use the install button to add ExchangeOnlineManagement for the current Windows user, or have IT deploy the module to this workstation.",
        canInstallModule: true,
      };
    }

    if (
      shell.exchangeCapabilities?.exchangeModule.installed === true &&
      shell.exchangeCapabilities.exchangeModule.importable === false
    ) {
      return {
        kind: "exchangeModuleNotImportable",
        title: "ExchangeOnlineManagement could not be loaded",
        detail:
          shell.exchangeCapabilities.exchangeModule.importError ??
          shell.exchangeCapabilities.detail,
        guidance: "Ask IT to review the module import failure. This is usually caused by a corrupted module install, missing dependency, or workstation security policy such as Constrained Language Mode, AppLocker, WDAC, or script-signing enforcement.",
        canInstallModule: false,
      };
    }

    return null;
  },
}));

vi.mock("@/renderer/components/ui/button", () => ({
  Button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("button", props, children),
}));

vi.mock("@/renderer/components/ui/input", () => ({
  Input: (props: Record<string, unknown>) =>
    React.createElement("input", props),
}));

vi.mock("./status-badge", () => ({
  StatusBadge: ({ children }: { children: React.ReactNode }) =>
    React.createElement("span", null, children),
}));

import { ShellAuthPanel } from "./shell-auth-panel";

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

interface MockAppValue {
  shell: ShellState;
  pendingAction: PendingAction;
  actionErrors: ActionErrors;
  exchangeUpn: string;
  setExchangeUpn: ReturnType<typeof vi.fn>;
  connectGraph: ReturnType<typeof vi.fn>;
  disconnectGraph: ReturnType<typeof vi.fn>;
  installExchangeModule: ReturnType<typeof vi.fn>;
  connectExchange: ReturnType<typeof vi.fn>;
  disconnectExchange: ReturnType<typeof vi.fn>;
  refreshShellState: ReturnType<typeof vi.fn>;
  currentScreen: string;
  setCurrentScreen: ReturnType<typeof vi.fn>;
}

function makeMockApp(overrides: Partial<MockAppValue> = {}): MockAppValue {
  return {
    shell: makeShell(),
    pendingAction: null,
    actionErrors: {},
    exchangeUpn: "",
    setExchangeUpn: vi.fn(),
    connectGraph: vi.fn(),
    disconnectGraph: vi.fn(),
    installExchangeModule: vi.fn(),
    connectExchange: vi.fn(),
    disconnectExchange: vi.fn(),
    refreshShellState: vi.fn(),
    currentScreen: "dashboard",
    setCurrentScreen: vi.fn(),
    ...overrides,
  };
}

function renderPanel(setupStep: AuthSetupStep, mockApp: Partial<MockAppValue> = {}) {
  useAppMock.mockReturnValue(makeMockApp(mockApp));
  return renderToStaticMarkup(
    React.createElement(ShellAuthPanel, { setupStep }),
  );
}

describe("ShellAuthPanel - graphNeeded branch", () => {
  beforeEach(() => {
    useAppMock.mockReset();
  });

  it("shows Graph sign-in progress while Graph connect is pending", () => {
    const markup = renderPanel("graphNeeded", {
      pendingAction: "graphConnect",
    });

    expect(markup).toContain("Connecting Graph");
    expect(markup).toContain("Opening Microsoft Graph sign-in...");
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("disabled");
  });

  it("shows PowerShell Exchange sign-in progress after Graph connects", () => {
    const markup = renderPanel("graphNeeded", {
      pendingAction: "exchangeConnect",
    });

    expect(markup).toContain("Signing in to Exchange");
    expect(markup).toContain("Graph connected. Signing in to PowerShell Exchange Online...");
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("disabled");
  });

  it("shows install affordance when ExchangeOnlineManagement is missing", () => {
    const markup = renderPanel("graphNeeded", {
      shell: makeShell({
        session: {
          appVersion: "1.0.0",
          environment: "development",
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
          security: {
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
          },
        },
      }),
    });

    expect(markup).toContain("ExchangeOnlineManagement is required");
    expect(markup).toContain("Use the install button to add ExchangeOnlineManagement for the current Windows user");
    expect(markup).toContain("Install Exchange module");
  });

  it("shows import failure without install affordance when ExchangeOnlineManagement is not importable", () => {
    const markup = renderPanel("exchangeNeeded", {
      shell: makeShell({
        graphConnection: makeGraph(),
        exchangeConnection: makeExchange({ state: "disconnected" }),
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
      }),
      exchangeUpn: "admin@example.com",
    });

    expect(markup).toContain("ExchangeOnlineManagement could not be loaded");
    expect(markup).toContain("File cannot be loaded because running scripts is disabled on this system.");
    expect(markup).toContain("Ask IT to review the module import failure.");
    expect(markup).not.toContain("Install Exchange module");
  });
});

describe("ShellAuthPanel - exchangeNeeded branch", () => {
  beforeEach(() => {
    useAppMock.mockReset();
  });

  it("shows Connect Exchange button with Plug icon when idle", () => {
    const markup = renderPanel("exchangeNeeded", {
      shell: makeShell({
        graphConnection: makeGraph(),
        exchangeConnection: makeExchange({ state: "disconnected" }),
      }),
      pendingAction: null,
      exchangeUpn: "admin@example.com",
    });

    expect(markup).toContain("Connect Exchange");
    expect(markup).not.toContain("Signing in...");
    expect(markup).not.toContain("Signing in to PowerShell Exchange Online...");
  });

  it("shows a compact restore banner when pendingAction is exchangeConnect", () => {
    const markup = renderPanel("exchangeNeeded", {
      shell: makeShell({
        graphConnection: makeGraph(),
        exchangeConnection: makeExchange({ state: "disconnected" }),
      }),
      pendingAction: "exchangeConnect",
      exchangeUpn: "admin@example.com",
    });

    expect(markup).toContain("Restoring Exchange Online");
    expect(markup).toContain("Signing in to PowerShell as admin@example.com.");
    expect(markup).not.toContain(">Connect Exchange<");
  });

  it("renders aria-live status line when pendingAction is exchangeConnect", () => {
    const markup = renderPanel("exchangeNeeded", {
      shell: makeShell({
        graphConnection: makeGraph(),
        exchangeConnection: makeExchange({ state: "disconnected" }),
      }),
      pendingAction: "exchangeConnect",
      exchangeUpn: "admin@example.com",
    });

    expect(markup).toContain("Signing in to PowerShell as admin@example.com.");
    expect(markup).toContain('aria-live="polite"');
  });

  it("hides the aria-live status line when pendingAction is null", () => {
    const markup = renderPanel("exchangeNeeded", {
      shell: makeShell({
        graphConnection: makeGraph(),
        exchangeConnection: makeExchange({ state: "disconnected" }),
      }),
      pendingAction: null,
      exchangeUpn: "admin@example.com",
    });

    expect(markup).not.toContain("Signing in to PowerShell as admin@example.com.");
  });

  it("does not render the manual connect controls when pendingAction is exchangeConnect", () => {
    const markup = renderPanel("exchangeNeeded", {
      shell: makeShell({
        graphConnection: makeGraph(),
        exchangeConnection: makeExchange({ state: "disconnected" }),
      }),
      pendingAction: "exchangeConnect",
      exchangeUpn: "admin@example.com",
    });

    expect(markup).toContain("Restoring Exchange Online");
    expect(markup).not.toContain("Connect Exchange");
  });

  it("still shows exchange error alongside in-progress state", () => {
    const markup = renderPanel("exchangeNeeded", {
      shell: makeShell({
        graphConnection: makeGraph(),
        exchangeConnection: makeExchange({ state: "disconnected" }),
      }),
      pendingAction: "exchangeConnect",
      actionErrors: { exchange: "Connection timed out." },
      exchangeUpn: "admin@example.com",
    });

    expect(markup).toContain("Restoring Exchange Online");
    expect(markup).toContain("Connection timed out.");
  });
});
