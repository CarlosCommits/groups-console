import { Loader2, LogOut } from "lucide-react";

import { cn } from "@/renderer/lib/utils";
import { ConsoleNav } from "./nav";
import { Avatar, AvatarFallback } from "@/renderer/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/renderer/components/ui/dropdown-menu";
import groupsConsoleLogo from "../../../../logos/Groups Console logo design concept 2.png";

export interface AppSidebarProps {
  userName?: string;
  userRole?: string;
  canSignOut?: boolean;
  isSigningOut?: boolean;
  onSignOut?: () => void;
  className?: string;
}

export function AppSidebar({
  userName = "Not connected",
  userRole = "No active session",
  canSignOut = false,
  isSigningOut = false,
  onSignOut,
  className,
}: AppSidebarProps) {
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <aside
      className={cn(
        "fixed left-0 top-[var(--app-title-bar-safe-height)] z-50 flex h-[calc(100vh-var(--app-title-bar-safe-height))] w-60 flex-col border-r border-[var(--color-outline-variant)]/30 bg-white px-3 py-4",
        className
      )}
    >
      <div className="mb-6 px-2">
        <div className="flex items-center gap-2">
          <span className="size-9 shrink-0 overflow-hidden rounded-lg">
            <img
              src={groupsConsoleLogo}
              alt=""
              aria-hidden="true"
              className="size-full scale-[2.05] object-cover origin-center translate-y-[3px]"
            />
          </span>
          <div>
            <span className="text-lg font-extrabold text-[var(--color-primary)] font-headline tracking-tight">
              Groups Console
            </span>
          </div>
        </div>
      </div>
      <ConsoleNav />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="mt-auto flex w-full items-center gap-3 border-t border-[var(--color-outline-variant)]/20 px-2 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-sidebar-ring)]"
            aria-label="Open profile menu"
          >
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-xs font-bold text-[var(--color-foreground)]">
                {userName}
              </span>
              <span className="truncate text-[10px] uppercase tracking-tighter text-[var(--color-outline)]">
                {userRole}
              </span>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="top"
          sideOffset={8}
          className="w-56"
        >
          <DropdownMenuLabel className="truncate">
            {userName}
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="mx-1 bg-[var(--color-outline-variant)]/30" />
          <DropdownMenuItem
            variant="destructive"
            disabled={!canSignOut || isSigningOut}
            onSelect={() => {
              onSignOut?.();
            }}
          >
            {isSigningOut ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogOut className="size-4" />
            )}
            {isSigningOut ? "Signing out..." : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </aside>
  );
}
