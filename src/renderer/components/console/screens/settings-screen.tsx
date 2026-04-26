import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Plug,
  RefreshCw,
  Terminal,
  Unplug,
  Wifi,
  XCircle,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/renderer/components/ui/table";
import { Button } from "@/renderer/components/ui/button";
import { Input } from "@/renderer/components/ui/input";
import {
  AppShell,
  StatusBadge,
} from "@/renderer/components/console";
import { useApp } from "@/renderer/components/console";
import {
  deriveCapabilityRows,
  type CapabilityStatus,
} from "@/renderer/components/console/reports-coverage";
import { SystemLogsPanel } from "@/renderer/components/console/system-logs-panel";
import { cn } from "@/renderer/lib/utils";
import type { BootstrapCheckStatus } from "@/shared/contracts/session";
import type { GraphConnectionState, GraphConnectionStatus } from "@/shared/contracts/graph";
import type { ExchangeConnectionState, ExchangeConnectionStatus } from "@/shared/contracts/exchange";

const GLOBAL_SYSTEM_LOG_SCOPE = { kind: "all" } as const;

const CAPABILITY_STATUS_ICON_MAP: Record<CapabilityStatus, typeof CheckCircle> = {
  available: CheckCircle,
  partial: Clock,
  deferred: Ban,
  unavailable: XCircle,
};

const CAPABILITY_STATUS_VARIANT_MAP: Record<CapabilityStatus, "success" | "warning" | "neutral" | "error"> = {
  available: "success",
  partial: "warning",
  deferred: "neutral",
  unavailable: "error",
};

const CAPABILITY_STATUS_LABEL_MAP: Record<CapabilityStatus, string> = {
  available: "Available",
  partial: "Partial",
  deferred: "Deferred",
  unavailable: "Unavailable",
};

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

function formatConnectionDate(isoUtc: string | null | undefined) {
  if (!isoUtc) return null;
  return new Date(isoUtc).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DetailItem({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="truncate text-xs font-medium text-slate-700">{value}</p>
    </div>
  );
}

function GraphConnectionSummary({ graphConnection }: { graphConnection?: GraphConnectionStatus | null }) {
  if (!graphConnection) return null;

  return (
    <div className="grid gap-3 pt-3 sm:grid-cols-3">
      <DetailItem
        label="Account"
        value={graphConnection.accountDisplayName ?? graphConnection.accountUsername}
      />
      <DetailItem label="Tenant" value={graphConnection.tenantDisplayName ?? graphConnection.tenantId} />
      <DetailItem label="Token Expires" value={formatConnectionDate(graphConnection.tokenExpiresOnUtc)} />
    </div>
  );
}

function ExchangeConnectionSummary({ exchangeConnection }: { exchangeConnection?: ExchangeConnectionStatus | null }) {
  if (!exchangeConnection) return null;

  const runtime = exchangeConnection.runtime
    ? `${exchangeConnection.runtime.label} ${exchangeConnection.runtime.version}`
    : null;

  return (
    <div className="grid gap-3 pt-3 sm:grid-cols-3">
      <DetailItem label="Account" value={exchangeConnection.userPrincipalName} />
      <DetailItem label="Connected" value={formatConnectionDate(exchangeConnection.connectedAtUtc)} />
      <DetailItem label="Runtime" value={runtime ?? exchangeConnection.tokenStatus} />
    </div>
  );
}

export function SettingsScreen() {
  const {
    shell,
    refreshShellState,
    pendingAction,
    actionErrors,
    exchangeUpn,
    setExchangeUpn,
    connectGraph,
    disconnectGraph,
    connectExchange,
    disconnectExchange,
  } = useApp();

  const { session, graphConnection, exchangeConnection, isHydrating, loadError } = shell;
  const capabilityRows = useMemo(() => deriveCapabilityRows(shell), [shell]);
  const powershellCheck = session?.checks.find((c) => c.id === "powershell");
  const logDirectoryCheck = session?.checks.find((c) => c.id === "logDirectory");

  const graphConnected = graphConnection?.state === "connected";
  const exchangeConnected = exchangeConnection?.state === "connected";
  const isBusy = pendingAction !== null || isHydrating;
  const [diagnosticsPending, setDiagnosticsPending] = useState(false);
  const [diagnosticsMessage, setDiagnosticsMessage] = useState<string | null>(null);

  return (
    <AppShell>
      <div className="py-6">
        <div className="flex items-center justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshShellState()}
            disabled={isHydrating}
            className="gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${isHydrating ? "animate-spin" : ""}`} />
            {isHydrating ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-[var(--color-error)]/30 bg-red-50 px-4 py-3 text-sm text-[var(--color-error)]">
          <AlertTriangle className="size-4 shrink-0" />
          <span>Failed to load application state: {loadError}</span>
        </div>
      )}

      <div className="max-w-4xl space-y-6">
        <div className="overflow-hidden rounded-lg border border-[var(--color-outline-variant)]/30 bg-white">
          <div className="flex items-center border-b border-[var(--color-outline-variant)]/10 bg-slate-50/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="size-5 text-[var(--color-primary)]" />
              <h2 className="text-sm font-extrabold font-headline">
                Connection Status
              </h2>
            </div>
          </div>

          <div className="divide-y divide-[var(--color-outline-variant)]/10">
            <section className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-teal-50 text-[var(--color-primary)]">
                    <Wifi className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-800">Microsoft Graph</h3>
                      {graphConnection ? (
                        <StatusBadge variant={graphStateToVariant(graphConnection.state)} size="sm">
                          {graphStateToLabel(graphConnection.state)}
                        </StatusBadge>
                      ) : (
                        <StatusBadge variant="neutral" size="sm">-</StatusBadge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {graphConnection?.detail ?? "Graph connection status is unavailable."}
                    </p>
                    <GraphConnectionSummary graphConnection={graphConnection} />
                    {actionErrors.graph && (
                      <p className="mt-2 text-xs text-[var(--color-error)]">{actionErrors.graph}</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 gap-1.5 text-xs"
                  disabled={isBusy}
                  onClick={() => {
                    void (graphConnected ? disconnectGraph() : connectGraph());
                  }}
                >
                  {graphConnected ? (
                    <>
                      <Unplug className="size-3.5" />
                      Disconnect
                    </>
                  ) : (
                    <>
                      <Plug className="size-3.5" />
                      Connect
                    </>
                  )}
                </Button>
              </div>
            </section>

            <section className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-1 gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                    <Plug className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-800">Exchange Online</h3>
                      {exchangeConnection ? (
                        <StatusBadge variant={exchangeStateToVariant(exchangeConnection.state)} size="sm">
                          {exchangeStateToLabel(exchangeConnection.state)}
                        </StatusBadge>
                      ) : (
                        <StatusBadge variant="neutral" size="sm">-</StatusBadge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {exchangeConnection?.detail ?? "Exchange connection status is unavailable."}
                    </p>
                    <ExchangeConnectionSummary exchangeConnection={exchangeConnection} />
                    {!exchangeConnected && (
                      <div className="mt-3 flex max-w-md items-center gap-2">
                        <Input
                          className="h-8 flex-1 text-xs"
                          placeholder="user@domain.com"
                          value={exchangeUpn}
                          onChange={(e) => setExchangeUpn(e.target.value)}
                          disabled={isBusy}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0 gap-1.5 text-xs"
                          disabled={isBusy || exchangeUpn.trim().length === 0}
                          onClick={() => {
                            void connectExchange();
                          }}
                        >
                          <Plug className="size-3.5" />
                          Connect
                        </Button>
                      </div>
                    )}
                    {actionErrors.exchange && (
                      <p className="mt-2 text-xs text-[var(--color-error)]">{actionErrors.exchange}</p>
                    )}
                  </div>
                </div>
                {exchangeConnected && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 gap-1.5 text-xs"
                    disabled={isBusy}
                    onClick={() => {
                      void disconnectExchange();
                    }}
                  >
                    <Unplug className="size-3.5" />
                    Disconnect
                  </Button>
                )}
              </div>
            </section>

            <section className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                    <Terminal className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-800">PowerShell</h3>
                      {powershellCheck ? (
                        <StatusBadge variant={checkStatusToVariant(powershellCheck.status)} size="sm">
                          {powershellCheck.status === "ready"
                            ? "Ready"
                            : powershellCheck.status === "warning"
                              ? "Warning"
                              : "Missing"}
                        </StatusBadge>
                      ) : (
                        <StatusBadge variant="neutral" size="sm">-</StatusBadge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {powershellCheck?.detail ?? "PowerShell runtime status is unavailable."}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-[var(--color-outline-variant)]/30 bg-white">
          <div className="flex items-center border-b border-[var(--color-outline-variant)]/10 bg-slate-50/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="size-5 text-[var(--color-primary)]" />
              <h2 className="text-sm font-extrabold font-headline">
                Capabilities & Status
              </h2>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-transparent">
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Surface
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Status
                </TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Detail
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {capabilityRows.map((row) => {
                const Icon = CAPABILITY_STATUS_ICON_MAP[row.status];
                return (
                  <TableRow key={row.id} className="hover:bg-slate-50/40">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={cn(
                            "size-4",
                            row.status === "available"
                              ? "text-[var(--color-primary)]"
                              : row.status === "partial"
                                ? "text-amber-500"
                                : row.status === "deferred"
                                  ? "text-slate-400"
                                  : "text-[var(--color-tertiary)]",
                          )}
                        />
                        <span className="text-xs font-semibold text-slate-800">
                          {row.surface}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        variant={CAPABILITY_STATUS_VARIANT_MAP[row.status]}
                        size="sm"
                      >
                        {CAPABILITY_STATUS_LABEL_MAP[row.status]}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right text-[11px] font-medium text-slate-500">
                      {row.detail}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="bg-white border border-[var(--color-outline-variant)]/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="size-5 text-[var(--color-primary)]" />
            <h2 className="text-sm font-extrabold font-headline">
              System Logs
            </h2>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Local troubleshooting logs for this application instance. These are not tenant-authoritative audit records.
          </p>
          <SystemLogsPanel scope={GLOBAL_SYSTEM_LOG_SCOPE} />
        </div>

        <div className="bg-white border border-[var(--color-outline-variant)]/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Download className="size-5 text-[var(--color-primary)]" />
            <h2 className="text-sm font-extrabold font-headline">Diagnostics</h2>
          </div>
          <div className="space-y-3 text-sm text-[var(--color-outline)]">
            <p>
              Export a redacted diagnostics bundle with recent logs, session checks, and the latest error summary.
            </p>
            {logDirectoryCheck && (
              <p className="text-xs text-slate-500">{logDirectoryCheck.detail}</p>
            )}
            {diagnosticsMessage && (
              <p className="text-xs text-[var(--color-primary)]">{diagnosticsMessage}</p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={
                diagnosticsPending ||
                isHydrating ||
                !window.groupsConsole?.diagnostics ||
                logDirectoryCheck?.status !== "ready"
              }
              onClick={() => {
                void (async () => {
                  setDiagnosticsPending(true);
                  setDiagnosticsMessage(null);
                  try {
                    const result = await window.groupsConsole.diagnostics.export();
                    setDiagnosticsMessage(`Diagnostics exported to ${result.outputPath}.`);
                  } catch (error) {
                    setDiagnosticsMessage(
                      error instanceof Error ? error.message : "Diagnostics export failed.",
                    );
                  } finally {
                    setDiagnosticsPending(false);
                  }
                })();
              }}
            >
              <Download className="size-3.5" />
              {diagnosticsPending ? "Exporting..." : "Export diagnostics"}
            </Button>
          </div>
        </div>

        <div className="bg-white border border-[var(--color-outline-variant)]/30 rounded-lg p-4">
          <h2 className="text-sm font-extrabold font-headline mb-4">
            About
          </h2>
          <div className="space-y-2 text-sm text-[var(--color-outline)]">
            <p>Groups Console {session?.appVersion ?? "-"}</p>
            <p>Electron renderer process with secure IPC bridge</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
