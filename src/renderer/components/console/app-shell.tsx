import * as React from "react";
import { cn } from "@/renderer/lib/utils";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";
import { useApp } from "./app-context";
import { deriveShellReadiness } from "./shell-readiness";
import { ShellAuthPanel } from "./shell-auth-panel";

export interface AppShellProps {
  children: React.ReactNode;
  className?: string;
}

export function AppShell({
  children,
  className,
}: AppShellProps) {
  const { shell, currentScreen, setCurrentScreen } = useApp();
  const hasResolvedShell =
    shell.session !== null ||
    shell.graphConnection !== null ||
    shell.exchangeConnection !== null ||
    shell.exchangeCapabilities !== null ||
    shell.loadError !== null;
  const summary = hasResolvedShell ? deriveShellReadiness(shell) : null;

  const handleNavigateSettings = React.useCallback(() => {
    setCurrentScreen("settings");
  }, [setCurrentScreen]);

  const authPanel = summary && summary.readiness !== "ready" ? (
    <ShellAuthPanel
      setupStep={summary.setupStep}
      blocking={summary.readiness === "signedOut"}
      onNavigateSettings={currentScreen !== "settings" ? handleNavigateSettings : undefined}
    />
  ) : null;

  return (
    <div className={cn("min-h-screen bg-[var(--color-surface)]", className)}>
      <AppSidebar
        userName={summary?.displayName ?? "Loading shell…"}
        userRole={summary?.secondaryLine ?? "Loading application state"}
      />
      <AppHeader
        graphConnected={summary?.graphConnected ?? false}
        exchangeActive={summary?.exchangeActive ?? false}
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