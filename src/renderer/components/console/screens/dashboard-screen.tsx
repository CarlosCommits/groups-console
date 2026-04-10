import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  RefreshCw,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  WifiOff,
  LayoutDashboard,
  FolderSearch,
  Settings,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/renderer/components/ui/table";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/renderer/components/ui/card";
import { Button } from "@/renderer/components/ui/button";
import {
  AppShell,
  PageHeader,
  StatCard,
  StatusBadge,
} from "@/renderer/components/console";
import {
  CONSOLE_SURFACE_CARD,
  CONSOLE_SURFACE_HEADER,
  CONSOLE_SURFACE_HEADER_COMPACT,
} from "@/renderer/components/console/surface-styles";
import { cn } from "@/renderer/lib/utils";
import { useApp } from "@/renderer/components/console/app-context";
import { deriveShellReadiness } from "@/renderer/components/console/shell-readiness";
import {
  deriveAttentionItems,
  countReadyChecks,
  type AttentionItem,
} from "@/renderer/components/console/dashboard-attention";
import type { ExchangeGroupListItem } from "@/shared/contracts/exchange";

const GROUP_KIND_LABELS: Record<ExchangeGroupListItem["groupKind"], string> = {
  distributionList: "Distribution",
  mailEnabledSecurityGroup: "Security",
};

const SEVERITY_ICON_MAP: Record<AttentionItem["severity"], typeof AlertCircle> = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_VARIANT_MAP: Record<AttentionItem["severity"], "error" | "warning" | "info"> = {
  error: "error",
  warning: "warning",
  info: "info",
};

const SEVERITY_BG_MAP: Record<AttentionItem["severity"], string> = {
  error: "bg-[var(--color-error-container)]/20",
  warning: "bg-amber-50",
  info: "bg-blue-50",
};

const SEVERITY_TEXT_MAP: Record<AttentionItem["severity"], string> = {
  error: "text-[var(--color-error)]",
  warning: "text-amber-600",
  info: "text-blue-600",
};

interface ShortcutItem {
  id: string;
  icon: typeof Users;
  label: string;
  screen: "groups" | "directory" | "settings";
}

const shortcuts: ShortcutItem[] = [
  { id: "open-groups", icon: Users, label: "Open Groups", screen: "groups" },
  { id: "open-directory", icon: FolderSearch, label: "Open Directory", screen: "directory" },
  { id: "open-settings", icon: Settings, label: "Open Settings", screen: "settings" },
];

export function DashboardScreen() {
  const { shell, refreshShellState, setCurrentScreen } = useApp();
  const readiness = deriveShellReadiness(shell);
  const attentionItems = deriveAttentionItems(shell);
  const { ready: readyChecks, total: totalChecks } = countReadyChecks(shell);

  const [groups, setGroups] = useState<ExchangeGroupListItem[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [hasLoadedGroups, setHasLoadedGroups] = useState(false);

  const exchangeConnected = shell.exchangeConnection?.state === "connected";

  const loadGroups = useCallback(async () => {
    if (!exchangeConnected) {
      setGroups([]);
      setGroupsError(null);
      setGroupsLoading(false);
      setHasLoadedGroups(false);
      return;
    }
    setGroupsLoading(true);
    setGroupsError(null);
    try {
      const result = await window.radApp.exchange.listGroups();
      setGroups(result.items);
      setHasLoadedGroups(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load groups.";
      setGroups([]);
      setGroupsError(message);
      setHasLoadedGroups(true);
    } finally {
      setGroupsLoading(false);
    }
  }, [exchangeConnected]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const recentGroups = useMemo(() => {
    const withDates = groups.filter((g) => g.whenChangedUtc !== null);
    withDates.sort(
      (a, b) =>
        new Date(b.whenChangedUtc!).getTime() - new Date(a.whenChangedUtc!).getTime(),
    );
    return withDates.slice(0, 5);
  }, [groups]);

  const distributionCount = groups.filter((g) => g.groupKind === "distributionList").length;
  const securityCount = groups.filter((g) => g.groupKind === "mailEnabledSecurityGroup").length;

  const readinessLabel: Record<string, string> = {
    ready: "Ready",
    partial: "Partial",
    signedOut: "Signed Out",
  };
  const readinessTrend: Record<string, "success" | "warning" | "error" | "neutral"> = {
    ready: "success",
    partial: "warning",
    signedOut: "neutral",
  };

  const isRefreshing = shell.isHydrating;

  const groupInventoryValue = !exchangeConnected
    ? "—"
    : groupsLoading || !hasLoadedGroups
      ? "…"
      : groupsError
        ? "Error"
        : String(groups.length);

  const groupInventoryTrend = !exchangeConnected
    ? undefined
    : groupsError
      ? "Load failed"
      : !groupsLoading && groups.length > 0
        ? `${distributionCount} DL · ${securityCount} SG`
        : undefined;

  const handleRefresh = async () => {
    await refreshShellState();
    if (exchangeConnected) {
      await loadGroups();
    }
  };

  if (shell.isHydrating && !shell.session) {
    return (
      <AppShell>
        <PageHeader title="System Home" description="Operational summary and quick management utilities." />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-8 text-[var(--color-primary)] animate-spin mr-3" />
          <span className="text-sm text-slate-500">Loading shell state…</span>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="System Home"
        description="Operational summary and quick management utilities."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            disabled={isRefreshing}
            onClick={() => {
              void handleRefresh();
            }}
          >
            <RefreshCw className={cn("size-3.5 mr-1.5", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8 space-y-5">
          <section className="grid grid-cols-3 gap-3">
            <StatCard
              label="Total Groups"
              value={groupInventoryValue}
              trend={groupInventoryTrend}
              trendType={groupsError ? "warning" : "neutral"}
            />
            <StatCard
              label="Shell Readiness"
              value={readinessLabel[readiness.readiness] ?? readiness.readiness}
              trend={readiness.displayName !== "Not connected" ? readiness.displayName : undefined}
              trendType={readinessTrend[readiness.readiness] ?? "neutral"}
            />
            <StatCard
              label="Bootstrap Checks"
              value={totalChecks > 0 ? `${readyChecks}/${totalChecks}` : "—"}
              trend={
                totalChecks > 0
                  ? readyChecks === totalChecks
                    ? "All passed"
                    : `${totalChecks - readyChecks} issue${totalChecks - readyChecks !== 1 ? "s" : ""}`
                  : undefined
              }
              trendType={
                totalChecks === 0
                  ? "neutral"
                  : readyChecks === totalChecks
                    ? "success"
                    : "warning"
              }
            />
          </section>

          <Card className={cn(CONSOLE_SURFACE_CARD, "overflow-hidden")}>
            <CardHeader
              className={cn(
                CONSOLE_SURFACE_HEADER,
                "bg-[var(--color-surface-container-low)] py-2.5",
              )}
            >
              <CardTitle className="text-xs font-extrabold font-headline flex items-center gap-2 uppercase tracking-wide text-[var(--color-foreground)]">
                <AlertCircle className="size-4 text-[var(--color-tertiary)]" />
                Attention Required
              </CardTitle>
              {attentionItems.length > 0 ? (
                <StatusBadge variant="warning" size="sm">
                  {attentionItems.length} Issue{attentionItems.length !== 1 ? "s" : ""}
                </StatusBadge>
              ) : (
                <StatusBadge variant="success" size="sm">
                  Clear
                </StatusBadge>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {attentionItems.length === 0 ? (
                <div className="p-6 flex flex-col items-center justify-center text-center">
                  <CheckCircle className="size-8 text-teal-500 mb-2" />
                  <p className="text-xs font-bold text-slate-700">No issues detected</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    All services and checks are operating normally.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-outline-variant)]/10">
                  {attentionItems.map((item) => {
                    const Icon = SEVERITY_ICON_MAP[item.severity];
                    return (
                      <div
                        key={item.id}
                        className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "w-8 h-8 rounded flex items-center justify-center",
                              SEVERITY_BG_MAP[item.severity],
                            )}
                          >
                            <Icon className={cn("size-[18px]", SEVERITY_TEXT_MAP[item.severity])} />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold">{item.title}</h3>
                            <p className="text-[11px] text-[var(--color-outline)]">
                              {item.description}
                            </p>
                          </div>
                        </div>
                        <StatusBadge variant={SEVERITY_VARIANT_MAP[item.severity]} size="sm">
                          {item.severity}
                        </StatusBadge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={CONSOLE_SURFACE_CARD}>
            <CardHeader className={CONSOLE_SURFACE_HEADER}>
              <CardTitle className="text-sm font-extrabold font-headline">
                Recently Modified Groups
              </CardTitle>
              {exchangeConnected && groups.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[11px] font-bold text-[var(--color-primary)]"
                  onClick={() => setCurrentScreen("groups")}
                >
                  View All
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {!exchangeConnected ? (
                <div className="p-6 flex flex-col items-center justify-center text-center">
                  <WifiOff className="size-8 text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-700">Exchange not connected</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Connect to Exchange to view group activity.
                  </p>
                </div>
              ) : groupsLoading ? (
                <div className="p-6 flex items-center justify-center">
                  <Loader2 className="size-5 text-[var(--color-primary)] animate-spin mr-2" />
                  <span className="text-sm text-slate-500">Loading groups…</span>
                </div>
              ) : groupsError ? (
                <div className="p-6 flex flex-col items-center justify-center text-center">
                  <AlertCircle className="size-8 text-[var(--color-error)] mb-2" />
                  <p className="text-xs font-bold text-slate-700">Failed to load groups</p>
                  <p className="text-[11px] text-slate-400 mt-1">{groupsError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 text-xs"
                    onClick={() => void loadGroups()}
                  >
                    Retry
                  </Button>
                </div>
              ) : !hasLoadedGroups ? (
                <div className="p-6 flex items-center justify-center">
                  <Loader2 className="size-5 text-[var(--color-primary)] animate-spin mr-2" />
                  <span className="text-sm text-slate-500">Loading groups…</span>
                </div>
              ) : recentGroups.length === 0 ? (
                <div className="p-6 flex flex-col items-center justify-center text-center">
                  <Users className="size-8 text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-700">No recent modifications</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Group modification timestamps will appear here when available.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-full">Group</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Modified</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentGroups.map((group) => (
                      <TableRow key={group.exchangeIdentity}>
                        <TableCell>
                          <div>
                            <p className="text-[11px] font-bold">{group.displayName}</p>
                            <p className="text-[10px] text-[var(--color-outline)]">
                              {group.primaryEmail ?? group.alias ?? "—"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant="neutral" size="sm">
                            {GROUP_KIND_LABELS[group.groupKind]}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-[11px] text-slate-500">
                            {formatRelativeDate(group.whenChangedUtc!)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-5">
          <Card
            className={cn(
              CONSOLE_SURFACE_CARD,
              "bg-[var(--color-primary)]/5 border-[var(--color-primary)]/10",
            )}
          >
            <CardHeader className={CONSOLE_SURFACE_HEADER_COMPACT}>
              <CardTitle className="text-xs font-extrabold uppercase tracking-widest text-[var(--color-primary)] flex items-center gap-2">
                <LayoutDashboard className="size-4" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-4">
              <div className="space-y-2">
                {shortcuts.map((shortcut) => (
                  <Button
                    key={shortcut.id}
                    variant="outline"
                    className="w-full flex items-center justify-between p-2.5 rounded-lg bg-white border-[var(--color-outline-variant)]/30 hover:border-[var(--color-primary)]/40 hover:shadow-sm transition-all"
                    onClick={() => setCurrentScreen(shortcut.screen)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-[var(--color-primary)]">
                        <shortcut.icon className="size-5" />
                      </div>
                      <span className="text-xs font-bold text-[var(--color-foreground)]">
                        {shortcut.label}
                      </span>
                    </div>
                    <ChevronRight className="size-4 text-[var(--color-outline)]" />
                  </Button>
                ))}
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-between p-2.5 rounded-lg bg-white border-[var(--color-outline-variant)]/30 hover:border-[var(--color-primary)]/40 hover:shadow-sm transition-all"
                  disabled={isRefreshing}
                  onClick={() => {
                    void handleRefresh();
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-[var(--color-primary)]">
                      <RefreshCw className={cn("size-5", isRefreshing && "animate-spin")} />
                    </div>
                    <span className="text-xs font-bold text-[var(--color-foreground)]">
                      Refresh State
                    </span>
                  </div>
                  <ChevronRight className="size-4 text-[var(--color-outline)]" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className={cn(CONSOLE_SURFACE_CARD, "overflow-hidden")}>
            <CardHeader
              className={cn(
                CONSOLE_SURFACE_HEADER,
                "bg-[var(--color-surface-container-low)] py-2.5",
              )}
            >
              <CardTitle className="text-xs font-extrabold font-headline flex items-center gap-2 uppercase tracking-wide text-[var(--color-foreground)]">
                Connection Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Microsoft Graph</span>
                <StatusBadge
                  variant={readiness.graphConnected ? "success" : shell.graphConnection?.state === "error" ? "error" : "neutral"}
                  size="sm"
                >
                  {readiness.graphConnected ? "Connected" : shell.graphConnection?.state === "error" ? "Error" : "Disconnected"}
                </StatusBadge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Exchange Online</span>
                <StatusBadge
                  variant={readiness.exchangeActive ? "success" : shell.exchangeConnection?.state === "error" ? "error" : "neutral"}
                  size="sm"
                >
                  {readiness.exchangeActive ? "Active" : shell.exchangeConnection?.state === "error" ? "Error" : "Disconnected"}
                </StatusBadge>
              </div>
              {shell.graphConnection?.exchangeAlignment && shell.graphConnection.exchangeAlignment !== "unknown" && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Tenant Alignment</span>
                  <StatusBadge
                    variant={shell.graphConnection.exchangeAlignment === "matched" ? "success" : "warning"}
                    size="sm"
                  >
                    {shell.graphConnection.exchangeAlignment === "matched" ? "Matched" : "Mismatched"}
                  </StatusBadge>
                </div>
              )}
              {shell.session && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Environment</span>
                  <span className="text-[11px] text-slate-500 capitalize">
                    {shell.session.environment}
                  </span>
                </div>
              )}
              {shell.session?.appVersion && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Version</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {shell.session.appVersion}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function formatRelativeDate(isoUtc: string): string {
  const date = new Date(isoUtc);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return date.toLocaleDateString();
}
