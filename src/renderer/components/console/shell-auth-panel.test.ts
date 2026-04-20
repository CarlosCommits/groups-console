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

describe("ShellAuthPanel – exchangeNeeded branch", () => {
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
    expect(markup).not.toContain("Connecting…");
    expect(markup).not.toContain("Connecting to Exchange Online…");
  });

  it("shows Connecting… label and spinner when pendingAction is exchangeConnect", () => {
    const markup = renderPanel("exchangeNeeded", {
      shell: makeShell({
        graphConnection: makeGraph(),
        exchangeConnection: makeExchange({ state: "disconnected" }),
      }),
      pendingAction: "exchangeConnect",
      exchangeUpn: "admin@example.com",
    });

    expect(markup).toContain("Connecting…");
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

    expect(markup).toContain("Connecting to Exchange Online…");
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

    expect(markup).not.toContain("Connecting to Exchange Online…");
  });

  it("disables the button when pendingAction is exchangeConnect", () => {
    const markup = renderPanel("exchangeNeeded", {
      shell: makeShell({
        graphConnection: makeGraph(),
        exchangeConnection: makeExchange({ state: "disconnected" }),
      }),
      pendingAction: "exchangeConnect",
      exchangeUpn: "admin@example.com",
    });

    // The button should be disabled because isBusy is true when pendingAction !== null
    expect(markup).toContain("disabled");
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

    expect(markup).toContain("Connecting…");
    expect(markup).toContain("Connection timed out.");
  });
});
