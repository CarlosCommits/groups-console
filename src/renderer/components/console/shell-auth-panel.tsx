import { Plug, Unplug, AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/renderer/components/ui/button";
import { Input } from "@/renderer/components/ui/input";
import { StatusBadge } from "./status-badge";
import {
  deriveExchangePrerequisiteBlocker,
  useApp,
  type ExchangePrerequisiteBlocker,
} from "./app-context";
import type { AuthSetupStep } from "./shell-readiness";

interface ShellAuthPanelProps {
  setupStep: AuthSetupStep;
  blocking?: boolean;
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

function ExchangePrerequisiteNotice({ blocker }: { blocker: ExchangePrerequisiteBlocker }) {
  return (
    <div className="w-full rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-left">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold text-amber-900">
            {blocker.title}
          </p>
          <p className="text-xs text-amber-800">{blocker.detail}</p>
          <p className="text-xs font-medium text-amber-900">{blocker.guidance}</p>
        </div>
      </div>
    </div>
  );
}

export function ShellAuthPanel({ setupStep, blocking }: ShellAuthPanelProps) {
  const {
    shell,
    pendingAction,
    actionErrors,
    exchangeUpn,
    setExchangeUpn,
    connectGraph,
    disconnectGraph,
    installExchangeModule,
    connectExchange,
    disconnectExchange,
  } = useApp();

  const isBusy = pendingAction !== null || shell.isHydrating;
  const isGraphConnecting = pendingAction === "graphConnect";
  const isExchangeModuleInstalling = pendingAction === "exchangeInstallModule";
  const isExchangeConnecting = pendingAction === "exchangeConnect";
  const isExchangeRestoreBanner = setupStep === "exchangeNeeded" && isExchangeConnecting;
  const exchangePrerequisiteBlocker = deriveExchangePrerequisiteBlocker(shell);

  const panelClass = isExchangeRestoreBanner
    ? "rounded-lg border border-teal-100 bg-white p-4 shadow-sm"
    : blocking
      ? "relative overflow-hidden rounded-lg border border-[var(--color-outline-variant)]/25 bg-[linear-gradient(180deg,#ffffff_0%,#f9fbfb_100%)] p-7 shadow-[0_18px_45px_rgba(25,28,30,0.08)]"
      : "rounded-lg border border-amber-200/70 bg-amber-50 p-4 shadow-sm";

  if (isExchangeRestoreBanner) {
    return (
      <div className={panelClass}>
        {shell.loadError && (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-[var(--color-error)]/20 bg-red-50 px-3 py-2 text-sm text-[var(--color-error)]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{shell.loadError}</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
            <Loader2 className="size-5 animate-spin text-[var(--color-primary)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <StatusBadge variant="success" size="sm">Graph Connected</StatusBadge>
              <span className="truncate text-xs text-[var(--color-outline)]">
                {shell.graphConnection?.accountUsername ?? ""}
              </span>
            </div>
            <h2 className="font-headline text-sm font-extrabold leading-tight text-[var(--color-foreground)]">
              Restoring Exchange Online
            </h2>
            <p className="mt-1 text-xs text-[var(--color-outline)]" aria-live="polite">
              Signing in to PowerShell as {exchangeUpn || shell.graphConnection?.accountUsername || "the selected account"}.
            </p>
          </div>
          <StatusBadge variant="warning" size="sm" className="shrink-0">
            Signing in
          </StatusBadge>
        </div>
        {actionErrors.exchange && (
          <p className="mt-3 text-xs text-[var(--color-error)]">{actionErrors.exchange}</p>
        )}
      </div>
    );
  }

  return (
    <div className={panelClass}>
      {blocking && (
        <div className="absolute inset-x-0 top-0 h-1 bg-[var(--color-primary)]" />
      )}

      {shell.loadError && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-[var(--color-error)]/20 bg-red-50 px-3 py-2 text-sm text-[var(--color-error)]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{shell.loadError}</span>
        </div>
      )}

      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-[var(--color-primary)]/15 bg-[var(--color-primary)]/8">
          <StepIcon step={setupStep} />
        </div>
        <div className="min-w-0 space-y-2">
          <h2 className="font-headline text-base font-extrabold leading-tight text-[var(--color-foreground)]">
            <StepTitle step={setupStep} />
          </h2>
          <StepDescription step={setupStep} />
        </div>
      </div>

      {setupStep === "graphNeeded" && (
        <div className="mt-5 flex flex-col items-center justify-center gap-3">
          {exchangePrerequisiteBlocker && (
            <ExchangePrerequisiteNotice blocker={exchangePrerequisiteBlocker} />
          )}
          <Button
            size="lg"
            className="gap-2 bg-[var(--color-primary)] px-4 text-white shadow-sm hover:bg-[var(--color-primary-container)]"
            disabled={isBusy}
            onClick={() => { void connectGraph(); }}
          >
            {isGraphConnecting || isExchangeConnecting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {isExchangeConnecting ? "Signing in to Exchange" : "Connecting Graph"}
              </>
            ) : (
              "Connect Graph"
            )}
          </Button>
          {(isGraphConnecting || isExchangeConnecting) && (
            <p className="text-center text-xs text-[var(--color-outline)]" aria-live="polite">
              {isExchangeConnecting
                ? "Graph connected. Signing in to PowerShell Exchange Online..."
                : "Opening Microsoft Graph sign-in..."}
            </p>
          )}
          {exchangePrerequisiteBlocker?.canInstallModule && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isBusy}
              onClick={() => { void installExchangeModule(); }}
            >
              {isExchangeModuleInstalling ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Installing module...
                </>
              ) : (
                "Install Exchange module"
              )}
            </Button>
          )}
          {actionErrors.graph && (
            <p className="text-xs font-medium text-[var(--color-error)]">{actionErrors.graph}</p>
          )}
          {actionErrors.exchange && (
            <p className="text-xs font-medium text-[var(--color-error)]">{actionErrors.exchange}</p>
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
          {exchangePrerequisiteBlocker && (
            <ExchangePrerequisiteNotice blocker={exchangePrerequisiteBlocker} />
          )}
          <div className="flex items-center gap-2">
            <Input
              className="h-8 text-sm flex-1 max-w-xs"
              placeholder="user@domain.com"
              value={exchangeUpn}
              onChange={(e) => setExchangeUpn(e.target.value)}
              disabled={isBusy || exchangePrerequisiteBlocker !== null}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isBusy || exchangeUpn.trim().length === 0 || exchangePrerequisiteBlocker !== null}
              onClick={() => { void connectExchange(); }}
            >
              <Plug className="size-3.5" />
              Connect Exchange
            </Button>
          </div>
          {exchangePrerequisiteBlocker?.canInstallModule && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isBusy}
              onClick={() => { void installExchangeModule(); }}
            >
              {isExchangeModuleInstalling ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Installing module...
                </>
              ) : (
                "Install Exchange module"
              )}
            </Button>
          )}
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

    </div>
  );
}
