import * as React from "react";
import { cn } from "@/renderer/lib/utils";
import type { UpdateStatus } from "@/shared/contracts/updates";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";
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
    <div className={cn("min-h-screen bg-[var(--color-surface)]", className)}>
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
      <main className="ml-60 pt-14 px-6 pb-6 min-h-screen">
        {summary?.readiness === "signedOut" ? (
          <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
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
