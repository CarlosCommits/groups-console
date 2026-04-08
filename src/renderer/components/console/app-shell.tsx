import * as React from "react";
import { cn } from "@/renderer/lib/utils";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";

export interface AppShellProps {
  children: React.ReactNode;
  graphConnected?: boolean;
  exchangeActive?: boolean;
  userName?: string;
  userAvatar?: string;
  className?: string;
}

export function AppShell({
  children,
  graphConnected = true,
  exchangeActive = true,
  userName = "Alex Rivera",
  userAvatar,
  className,
}: AppShellProps) {
  return (
    <div className={cn("min-h-screen bg-[var(--color-surface)]", className)}>
      <AppSidebar
        userName={userName}
        userRole="System Admin"
        userAvatar={userAvatar}
      />
      <AppHeader
        graphConnected={graphConnected}
        exchangeActive={exchangeActive}
        userName={userName}
        userAvatar={userAvatar}
      />
      <main className="ml-60 pt-14 px-6 pb-6 min-h-screen">
        {children}
      </main>
    </div>
  );
}
