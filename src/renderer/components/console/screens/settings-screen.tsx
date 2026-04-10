import {
  useState,
  useEffect,
} from "react";
import {
  Shield,
  Lock,
  Unlock,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  Plug,
  Unplug,
} from "lucide-react";
import { Switch } from "@/renderer/components/ui/switch";
import { Button } from "@/renderer/components/ui/button";
import { Input } from "@/renderer/components/ui/input";
import {
  AppShell,
  StatusBadge,
} from "@/renderer/components/console";
import { useApp } from "@/renderer/components/console";
import type { BootstrapCheckStatus } from "@/shared/contracts/session";
import type { GraphConnectionState } from "@/shared/contracts/graph";
import type { ExchangeConnectionState } from "@/shared/contracts/exchange";

type PendingAction =
  | "graphConnect"
  | "graphDisconnect"
  | "exchangeConnect"
  | "exchangeDisconnect"
  | null;

interface ActionErrors {
  graph?: string;
  exchange?: string;
}

interface SettingRowProps {
  label: string;
  description?: string;
  enabled?: boolean;
  disabled?: boolean;
}

function SettingRow({ label, description, enabled = false, disabled = false }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--color-outline-variant)]/10 last:border-0">
      <div className="flex items-center gap-3">
        {enabled ? (
          <Lock className="size-4 text-emerald-500" />
        ) : (
          <Unlock className="size-4 text-amber-500" />
        )}
        <div>
          <div className="text-sm font-medium">{label}</div>
          {description && (
            <div className="text-xs text-[var(--color-outline)]">
              {description}
            </div>
          )}
        </div>
      </div>
      <Switch checked={enabled} disabled={disabled} />
    </div>
  );
}

function checkStatusToVariant(status: BootstrapCheckStatus) {
  switch (status) {
    case "ready":
      return "success" as const;
    case "warning":
      return "warning" as const;
    case "missing":
      return "error" as const;
  }
}

function graphStateToVariant(state: GraphConnectionState) {
  switch (state) {
    case "connected":
      return "success" as const;
    case "disconnected":
      return "neutral" as const;
    case "error":
      return "error" as const;
  }
}

function graphStateToLabel(state: GraphConnectionState) {
  switch (state) {
    case "connected":
      return "Connected";
    case "disconnected":
      return "Disconnected";
    case "error":
      return "Error";
  }
}

function exchangeStateToVariant(state: ExchangeConnectionState) {
  switch (state) {
    case "connected":
      return "success" as const;
    case "disconnected":
      return "neutral" as const;
    case "error":
      return "error" as const;
  }
}

function exchangeStateToLabel(state: ExchangeConnectionState) {
  switch (state) {
    case "connected":
      return "Active";
    case "disconnected":
      return "Inactive";
    case "error":
      return "Error";
  }
}

export function SettingsScreen() {
  const { shell, refreshShellState } = useApp();
  const { session, graphConnection, exchangeConnection, isHydrating, loadError } = shell;

  const security = session?.security;
  const powershellCheck = session?.checks.find((c) => c.id === "powershell");

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionErrors, setActionErrors] = useState<ActionErrors>({});

  const exchangeUpnPreset =
    exchangeConnection?.userPrincipalName ??
    graphConnection?.accountUsername ??
    "";
  const [exchangeUpn, setExchangeUpn] = useState(exchangeUpnPreset);

  useEffect(() => {
    setExchangeUpn((currentValue) => {
      if (currentValue.trim().length > 0 && currentValue !== exchangeUpnPreset) {
        return currentValue;
      }

      return exchangeUpnPreset;
    });
  }, [exchangeUpnPreset]);

  const clearError = (key: keyof ActionErrors) => {
    setActionErrors((prev) => {
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return prev;
    });
  };

  const handleGraphConnect = async () => {
    setPendingAction("graphConnect");
    clearError("graph");
    try {
      const result = await window.radApp.graph.connect();
      if (result.state === "error") {
        setActionErrors((prev) => ({ ...prev, graph: result.detail }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Graph connect failed.";
      setActionErrors((prev) => ({ ...prev, graph: message }));
    } finally {
      setPendingAction(null);
      await refreshShellState();
    }
  };

  const handleGraphDisconnect = async () => {
    setPendingAction("graphDisconnect");
    clearError("graph");
    try {
      const result = await window.radApp.graph.disconnect();
      if (result.state === "error") {
        setActionErrors((prev) => ({ ...prev, graph: result.detail }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Graph disconnect failed.";
      setActionErrors((prev) => ({ ...prev, graph: message }));
    } finally {
      setPendingAction(null);
      await refreshShellState();
    }
  };

  const handleExchangeConnect = async () => {
    setPendingAction("exchangeConnect");
    clearError("exchange");
    try {
      const result = await window.radApp.exchange.connect(exchangeUpn.trim());
      if (result.state === "error") {
        setActionErrors((prev) => ({ ...prev, exchange: result.detail }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Exchange connect failed.";
      setActionErrors((prev) => ({ ...prev, exchange: message }));
    } finally {
      setPendingAction(null);
      await refreshShellState();
    }
  };

  const handleExchangeDisconnect = async () => {
    setPendingAction("exchangeDisconnect");
    clearError("exchange");
    try {
      const result = await window.radApp.exchange.disconnect();
      if (result.state === "error") {
        setActionErrors((prev) => ({ ...prev, exchange: result.detail }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Exchange disconnect failed.";
      setActionErrors((prev) => ({ ...prev, exchange: message }));
    } finally {
      setPendingAction(null);
      await refreshShellState();
    }
  };

  const graphConnected = graphConnection?.state === "connected";
  const exchangeConnected = exchangeConnection?.state === "connected";

  return (
    <AppShell>
      <div className="py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--color-foreground)] font-headline tracking-tight">
              Settings
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure application preferences and security settings.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshShellState()}
            disabled={isHydrating}
            className="gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${isHydrating ? "animate-spin" : ""}`} />
            {isHydrating ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-[var(--color-error)]/30 bg-red-50 px-4 py-3 text-sm text-[var(--color-error)]">
          <AlertTriangle className="size-4 shrink-0" />
          <span>Failed to load application state: {loadError}</span>
        </div>
      )}

      <div className="max-w-3xl space-y-6">
        <div className="bg-white border border-[var(--color-outline-variant)]/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="size-5 text-[var(--color-primary)]" />
            <h2 className="text-sm font-extrabold font-headline">
              Security Configuration
            </h2>
          </div>
          <div className="divide-y divide-[var(--color-outline-variant)]/10">
            <SettingRow
              label="Context Isolation"
              description="Enable context isolation for enhanced security"
              enabled={security?.contextIsolation ?? true}
              disabled
            />
            <SettingRow
              label="Sandbox Mode"
              description="Run renderer process in sandboxed environment"
              enabled={security?.sandbox ?? true}
              disabled
            />
            <SettingRow
              label="Node Integration"
              description="Allow Node.js integration in renderer (not recommended)"
              enabled={security?.nodeIntegration ?? false}
              disabled
            />
          </div>
        </div>

        <div className="bg-white border border-[var(--color-outline-variant)]/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="size-5 text-[var(--color-primary)]" />
            <h2 className="text-sm font-extrabold font-headline">
              Connection Status
            </h2>
          </div>
          <div className="space-y-3">
            <div className="py-2">
              <div className="flex items-center justify-between">
                <div className="text-sm">Microsoft Graph</div>
                <div className="flex items-center gap-2">
                  {graphConnection ? (
                    <StatusBadge variant={graphStateToVariant(graphConnection.state)}>
                      {graphStateToLabel(graphConnection.state)}
                    </StatusBadge>
                  ) : (
                    <StatusBadge variant="neutral">—</StatusBadge>
                  )}
                   <Button
                     variant="outline"
                     size="sm"
                     className="h-7 gap-1 text-xs"
                     disabled={pendingAction !== null || isHydrating}
                     onClick={() => {
                       void (graphConnected ? handleGraphDisconnect() : handleGraphConnect());
                     }}
                   >
                    {graphConnected ? (
                      <>
                        <Unplug className="size-3" />
                        Disconnect
                      </>
                    ) : (
                      <>
                        <Plug className="size-3" />
                        Connect
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {actionErrors.graph && (
                <p className="mt-1 text-xs text-[var(--color-error)]">{actionErrors.graph}</p>
              )}
            </div>

            <div className="py-2">
              <div className="flex items-center justify-between">
                <div className="text-sm">Exchange Online</div>
                {exchangeConnection ? (
                  <StatusBadge variant={exchangeStateToVariant(exchangeConnection.state)}>
                    {exchangeStateToLabel(exchangeConnection.state)}
                  </StatusBadge>
                ) : (
                  <StatusBadge variant="neutral">—</StatusBadge>
                )}
              </div>
              {!exchangeConnected && (
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    className="h-7 text-xs flex-1"
                    placeholder="user@domain.com"
                    value={exchangeUpn}
                    onChange={(e) => setExchangeUpn(e.target.value)}
                    disabled={pendingAction !== null || isHydrating}
                  />
                   <Button
                     variant="outline"
                     size="sm"
                     className="h-7 gap-1 text-xs"
                     disabled={pendingAction !== null || isHydrating || exchangeUpn.trim().length === 0}
                     onClick={() => {
                       void handleExchangeConnect();
                     }}
                   >
                    <Plug className="size-3" />
                    Connect
                  </Button>
                </div>
              )}
              {exchangeConnected && (
                <div className="mt-2">
                   <Button
                     variant="outline"
                     size="sm"
                     className="h-7 gap-1 text-xs"
                     disabled={pendingAction !== null || isHydrating}
                     onClick={() => {
                       void handleExchangeDisconnect();
                     }}
                   >
                    <Unplug className="size-3" />
                    Disconnect
                  </Button>
                </div>
              )}
              {actionErrors.exchange && (
                <p className="mt-1 text-xs text-[var(--color-error)]">{actionErrors.exchange}</p>
              )}
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="text-sm">PowerShell</div>
              {powershellCheck ? (
                <StatusBadge variant={checkStatusToVariant(powershellCheck.status)}>
                  {powershellCheck.status === "ready"
                    ? "Ready"
                    : powershellCheck.status === "warning"
                      ? "Warning"
                      : "Missing"}
                </StatusBadge>
              ) : (
                <StatusBadge variant="neutral">—</StatusBadge>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-[var(--color-outline-variant)]/30 rounded-lg p-4">
          <h2 className="text-sm font-extrabold font-headline mb-4">
            About
          </h2>
          <div className="space-y-2 text-sm text-[var(--color-outline)]">
            <p>Groups Console {session?.appVersion ?? "—"}</p>
            <p>Electron renderer process with secure IPC bridge</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
