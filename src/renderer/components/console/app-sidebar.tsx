import { cn } from "@/renderer/lib/utils";
import { ConsoleNav } from "./nav";
import { Avatar, AvatarFallback } from "@/renderer/components/ui/avatar";
import groupsConsoleLogo from "../../../../logos/Groups Console logo design concept 2.png";

export interface AppSidebarProps {
  userName?: string;
  userRole?: string;
  className?: string;
}

export function AppSidebar({
  userName = "Not connected",
  userRole = "No active session",
  className,
}: AppSidebarProps) {
  return (
    <aside
      className={cn(
        "h-screen w-60 fixed left-0 top-0 bg-white border-r border-[var(--color-outline-variant)]/30 flex flex-col py-4 px-3 z-50",
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
      <div className="mt-auto px-2 py-3 border-t border-[var(--color-outline-variant)]/20 flex items-center gap-3">
        <Avatar className="size-8">
          <AvatarFallback className="text-xs">
            {userName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold text-[var(--color-foreground)] truncate">
            {userName}
          </span>
          <span className="text-[10px] text-[var(--color-outline)] truncate uppercase tracking-tighter">
            {userRole}
          </span>
        </div>
      </div>
    </aside>
  );
}
