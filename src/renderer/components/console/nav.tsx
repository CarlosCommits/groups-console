import {
  LayoutDashboard,
  Users,
  FolderSearch,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/renderer/lib/utils";
import { useApp } from "./app-context";

type Screen = "dashboard" | "groups" | "directory" | "reports" | "settings";

export interface NavItemProps {
  screen: Screen;
  icon: LucideIcon;
  label: string;
  className?: string;
}

export function NavItem({
  screen,
  icon: Icon,
  label,
  className,
}: NavItemProps) {
  const { currentScreen, setCurrentScreen } = useApp();
  const isActive = currentScreen === screen;

  return (
    <button
      onClick={() => setCurrentScreen(screen)}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
        isActive
          ? "bg-[var(--color-primary)]/5 text-[var(--color-primary)] font-bold"
          : "text-slate-600 hover:text-[var(--color-primary)] hover:bg-slate-100",
        className
      )}
    >
      <Icon className="size-[20px]" data-icon="inline-start" />
      <span>{label}</span>
    </button>
  );
}

export interface ConsoleNavProps {
  className?: string;
}

const navItems: { screen: Screen; icon: LucideIcon; label: string }[] = [
  { screen: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { screen: "groups", icon: Users, label: "Groups" },
  { screen: "directory", icon: FolderSearch, label: "Directory" },
  { screen: "reports", icon: BarChart3, label: "Reports" },
  { screen: "settings", icon: Settings, label: "Settings" },
];

export function ConsoleNav({
  className,
}: ConsoleNavProps) {
  return (
    <nav className={cn("space-y-0.5", className)}>
      {navItems.map((item) => (
        <NavItem
          key={item.screen}
          screen={item.screen}
          icon={item.icon}
          label={item.label}
        />
      ))}
    </nav>
  );
}
