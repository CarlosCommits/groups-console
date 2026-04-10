import { Plug, Unplug, AlertTriangle, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/renderer/components/ui/button";
import { Input } from "@/renderer/components/ui/input";
import { StatusBadge } from "./status-badge";
import { useApp } from "./app-context";
import type { AuthSetupStep } from "./shell-readiness";

interface ShellAuthPanelProps {
  setupStep: AuthSetupStep;
  blocking?: boolean;
  onNavigateSettings?: () => void;
}

function StepIcon({ step }: { step: AuthSetupStep }) {
  switch (step) {
    case "graphNeeded":
      return <Plug className="size-5 text-[var(--color-primary)]" />;
    case "exchangeNeeded":
      return <Plug className="size-5 text-[var(--color-primary)]" />;
    case "mismatched":
      return <AlertTriangle className="size-5 text-amber-600" />;
    case "ready":
      return <ShieldCheck className="size-5 text-teal-600" />;
  }
}

function StepTitle({ step }: { step: AuthSetupStep }) {
  switch (step) {
    case "graphNeeded":
      return "Connect Microsoft Graph";
    case "exchangeNeeded":
      return "Connect Exchange Online";
    case "mismatched":
      return "Tenant Alignment Issue";
    case "ready":
      return "All Services Connected";
  }
}

function StepDescription({ step }: { step: AuthSetupStep }) {
  switch (step) {
    case "graphNeeded":
      return (
        <p className="text-sm text-[var(--color-outline)]">
          Sign in with your Microsoft account to connect Graph. This is the first step to
          activating the console.
        </p>
      );
    case "exchangeNeeded":
      return (
        <p className="text-sm text-[var(--color-outline)]">
          Graph is connected. Enter your Exchange Online UPN to complete setup and enable
          group management features.
        </p>
      );
    case "mismatched":
      return (
        <p className="text-sm text-[var(--color-outline)]">
          Your Graph and Exchange sessions are connected to different tenants. Disconnect
          one service and reconnect with matching credentials, or visit Settings for
          details.
        </p>
      );
    case "ready":
      return null;
  }
}

export function ShellAuthPanel({ setupStep, blocking, onNavigateSettings }: ShellAuthPanelProps) {
  const {
    shell,
    pendingAction,
    actionErrors,
    exchangeUpn,
    setExchangeUpn,
    connectGraph,
    disconnectGraph,
    connectExchange,
    disconnectExchange,
  } = useApp();

  const isBusy = pendingAction !== null || shell.isHydrating;

  const panelClass = blocking
    ? "bg-white border border-[var(--color-outline-variant)]/30 rounded-lg p-6"
    : "bg-amber-50 border border-amber-200/60 rounded-lg p-4";

  return (
    <div className={panelClass}>
      {shell.loadError && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-[var(--color-error)]/20 bg-red-50 px-3 py-2 text-sm text-[var(--color-error)]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{shell.loadError}</span>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <StepIcon step={setupStep} />
        <h2 className="text-sm font-extrabold font-headline">
          <StepTitle step={setupStep} />
        </h2>
      </div>

      <StepDescription step={setupStep} />

      {setupStep === "graphNeeded" && (
        <div className="mt-4 flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={isBusy}
            onClick={() => { void connectGraph(); }}
          >
            {shell.graphConnection?.state === "connected" ? (
              <>
                <Unplug className="size-3.5" />
                Disconnect Graph
              </>
            ) : (
              <>
                <Plug className="size-3.5" />
                Connect Graph
              </>
            )}
          </Button>
          {actionErrors.graph && (
            <p className="text-xs text-[var(--color-error)]">{actionErrors.graph}</p>
          )}
        </div>
      )}

      {setupStep === "exchangeNeeded" && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <StatusBadge variant="success" size="sm">Graph Connected</StatusBadge>
            <span className="text-xs text-[var(--color-outline)]">
              {shell.graphConnection?.accountUsername ?? ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              className="h-8 text-sm flex-1 max-w-xs"
              placeholder="user@domain.com"
              value={exchangeUpn}
              onChange={(e) => setExchangeUpn(e.target.value)}
              disabled={isBusy}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isBusy || exchangeUpn.trim().length === 0}
              onClick={() => { void connectExchange(); }}
            >
              <Plug className="size-3.5" />
              Connect Exchange
            </Button>
          </div>
          {actionErrors.exchange && (
            <p className="text-xs text-[var(--color-error)]">{actionErrors.exchange}</p>
          )}
        </div>
      )}

      {setupStep === "mismatched" && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <StatusBadge variant="success" size="sm">Graph</StatusBadge>
              <span className="text-xs text-[var(--color-outline)]">
                {shell.graphConnection?.accountUsername ?? "—"} · Tenant {shell.graphConnection?.tenantId ?? "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge variant="success" size="sm">Exchange</StatusBadge>
              <span className="text-xs text-[var(--color-outline)]">
                {shell.exchangeConnection?.userPrincipalName ?? "—"} · Tenant {shell.exchangeConnection?.tenantId ?? "—"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isBusy}
              onClick={() => { void disconnectGraph(); }}
            >
              <Unplug className="size-3.5" />
              Disconnect Graph
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isBusy}
              onClick={() => { void disconnectExchange(); }}
            >
              <Unplug className="size-3.5" />
              Disconnect Exchange
            </Button>
          </div>
          {actionErrors.graph && (
            <p className="text-xs text-[var(--color-error)]">{actionErrors.graph}</p>
          )}
          {actionErrors.exchange && (
            <p className="text-xs text-[var(--color-error)]">{actionErrors.exchange}</p>
          )}
        </div>
      )}

      {onNavigateSettings && (
        <div className="mt-4 pt-3 border-t border-[var(--color-outline-variant)]/10">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-outline)] hover:text-[var(--color-foreground)] transition-colors"
            onClick={onNavigateSettings}
          >
            View detailed status in Settings
            <ArrowRight className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}
