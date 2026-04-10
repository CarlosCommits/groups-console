import { Search, Bell } from "lucide-react";
import { cn } from "@/renderer/lib/utils";
import { ConnectionStatus, StatusBadge } from "./status-badge";
import { Input } from "@/renderer/components/ui/input";
import { Avatar, AvatarFallback } from "@/renderer/components/ui/avatar";
import { Button } from "@/renderer/components/ui/button";
import type { ReadinessLevel } from "./shell-readiness";

const readinessConfig: Record<ReadinessLevel, { label: string; variant: "success" | "warning" | "error" }> = {
  ready: { label: "Ready", variant: "success" },
  partial: { label: "Partial", variant: "warning" },
  signedOut: { label: "Signed out", variant: "error" },
};

export interface AppHeaderProps {
  graphConnected?: boolean;
  exchangeActive?: boolean;
  readiness?: ReadinessLevel;
  userName?: string;
  className?: string;
}

export function AppHeader({
  graphConnected = false,
  exchangeActive = false,
  readiness,
  userName = "Admin User",
  className,
}: AppHeaderProps) {
  const readinessDisplay = readiness ? readinessConfig[readiness] : null;

  return (
    <header
      className={cn(
        "fixed top-0 left-60 right-0 h-14 bg-white/90 backdrop-blur-md border-b border-[var(--color-outline-variant)]/30 flex justify-between items-center px-6 z-40",
        className
      )}
    >
      <div className="relative w-96">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 size-[18px]" />
        <Input
          className="w-full bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/40 rounded-lg py-1.5 pl-9 pr-3 text-sm"
          placeholder="Search resources..."
          type="text"
        />
      </div>
      <div className="flex items-center gap-4">
        <ConnectionStatus
          graphConnected={graphConnected}
          exchangeActive={exchangeActive}
        />
        {readinessDisplay && (
          <StatusBadge variant={readinessDisplay.variant} size="sm">
            {readinessDisplay.label}
          </StatusBadge>
        )}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-4" />
          <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-[var(--color-error)] rounded-full border-2 border-white" />
        </Button>
        <Avatar className="size-7">
          <AvatarFallback className="text-xs">
            {userName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}