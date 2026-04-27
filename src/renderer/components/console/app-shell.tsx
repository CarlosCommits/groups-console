import * as React from "react";
import { cn } from "@/renderer/lib/utils";
import type { UpdateStatus } from "@/shared/contracts/updates";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";
import { AppTitleBar } from "./app-title-bar";
import { useApp, type Screen } from "./app-context";
import { deriveShellReadiness } from "./shell-readiness";
import { ShellAuthPanel } from "./shell-auth-panel";

export interface AppShellProps {
  children: React.ReactNode;
  className?: string;
}

const SCREEN_TITLES: Record<Screen, string> = {
  dashboard: "Dashboard",
  groups: "Groups",
  directory: "Directory Workspace",
  reports: "Reports",
  settings: "Settings",
};

function useUpdateStatus() {
  const [updateStatus, setUpdateStatus] = React.useState<UpdateStatus | null>(null);

  React.useEffect(() => {
    if (!window.groupsConsole?.updates) {
      return;
    }

    let active = true;
    void window.groupsConsole.updates.getStatus().then((status) => {
      if (active) {
        setUpdateStatus(status);
      }
    }).catch(() => {
      // Update status is non-critical shell chrome; keep the app usable if the bridge rejects.
    });

    const unsubscribe = window.groupsConsole.updates.onStatusChanged((status) => {
      setUpdateStatus(status);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const installUpdate = React.useCallback(() => {
    if (!window.groupsConsole?.updates) {
      return;
    }

    void window.groupsConsole.updates.install().then(setUpdateStatus).catch(() => {
      // The main process owns install failure state; avoid unhandled renderer rejections.
    });
  }, []);

  return { updateStatus, installUpdate };
}

export function AppShell({
  children,
  className,
}: AppShellProps) {
  const { shell, currentScreen } = useApp();
  const { updateStatus, installUpdate } = useUpdateStatus();
  const hasResolvedShell =
    shell.session !== null ||
    shell.graphConnection !== null ||
    shell.exchangeConnection !== null ||
    shell.exchangeCapabilities !== null ||
    shell.loadError !== null;
  const summary = hasResolvedShell ? deriveShellReadiness(shell) : null;

  const authPanel = summary && summary.readiness !== "ready" ? (
    <ShellAuthPanel
      setupStep={summary.setupStep}
      blocking={summary.readiness === "signedOut"}
    />
  ) : null;

  return (
    <div className={cn("h-screen overflow-hidden bg-[var(--color-surface)]", className)}>
      <AppTitleBar />
      <AppSidebar
        userName={summary?.displayName ?? "Loading shell…"}
        userRole={summary?.secondaryLine ?? "Loading application state"}
      />
      <AppHeader
        title={SCREEN_TITLES[currentScreen]}
        graphConnected={summary?.graphConnected ?? false}
        exchangeActive={summary?.exchangeActive ?? false}
        updateStatus={updateStatus}
        onInstallUpdate={installUpdate}
      />
      <main className="fixed top-[calc(var(--app-title-bar-safe-height)+3.5rem)] right-0 bottom-0 left-60 overflow-auto px-6 py-6">
        {summary?.readiness === "signedOut" ? (
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-md">
              {authPanel}
            </div>
          </div>
        ) : (
          <>
            {authPanel && (
              <div className="mb-6">
                {authPanel}
              </div>
            )}
            {children}
          </>
        )}
      </main>
    </div>
  );
}
