import * as React from "react";
import { cn } from "@/renderer/lib/utils";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";
import { useApp } from "./app-context";
import { deriveShellReadiness } from "./shell-readiness";

export interface AppShellProps {
  children: React.ReactNode;
  className?: string;
}

export function AppShell({
  children,
  className,
}: AppShellProps) {
  const { shell } = useApp();
  const hasResolvedShell =
    shell.session !== null ||
    shell.graphConnection !== null ||
    shell.exchangeConnection !== null ||
    shell.exchangeCapabilities !== null ||
    shell.loadError !== null;
  const summary = hasResolvedShell ? deriveShellReadiness(shell) : null;

  return (
    <div className={cn("min-h-screen bg-[var(--color-surface)]", className)}>
      <AppSidebar
        userName={summary?.displayName ?? "Loading shell…"}
        userRole={summary?.secondaryLine ?? "Loading application state"}
      />
      <AppHeader
        graphConnected={summary?.graphConnected ?? false}
        exchangeActive={summary?.exchangeActive ?? false}
        readiness={summary?.readiness}
        userName={summary?.displayName ?? "Loading shell"}
      />
      <main className="ml-60 pt-14 px-6 pb-6 min-h-screen">
        {children}
      </main>
    </div>
  );
}
