import { useState, useCallback, useMemo } from "react";
import {
  FileDown,
  ShieldCheck,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Ban,
  RefreshCw,
  FolderOpen,
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/renderer/components/ui/select";
import { Progress } from "@/renderer/components/ui/progress";
import { AppShell, StatusBadge } from "@/renderer/components/console";
import {
  CONSOLE_SURFACE_CARD,
  CONSOLE_SURFACE_HEADER,
  CONSOLE_SURFACE_HEADER_COMPACT,
} from "@/renderer/components/console/surface-styles";
import { cn } from "@/renderer/lib/utils";
import { useApp } from "@/renderer/components/console/app-context";
import { useExchangeGroupsQuery } from "@/renderer/hooks/use-exchange-groups";
import {
  deriveCapabilityRows,
  deriveCoverageSummary,
  type CapabilityStatus,
} from "@/renderer/components/console/reports-coverage";
import type {
  ReportGroupKind,
} from "@/shared/contracts/reports";

const STATUS_ICON_MAP: Record<CapabilityStatus, typeof CheckCircle> = {
  available: CheckCircle,
  partial: Clock,
  deferred: Ban,
  unavailable: XCircle,
};

const STATUS_VARIANT_MAP: Record<CapabilityStatus, "success" | "warning" | "neutral" | "error"> = {
  available: "success",
  partial: "warning",
  deferred: "neutral",
  unavailable: "error",
};

const STATUS_LABEL_MAP: Record<CapabilityStatus, string> = {
  available: "Available",
  partial: "Partial",
  deferred: "Deferred",
  unavailable: "Unavailable",
};

const KIND_LABELS: Record<ReportGroupKind, string> = {
  all: "All Groups",
  distributionList: "Distribution Lists",
  mailEnabledSecurityGroup: "Security Groups",
};

export function ReportsScreen() {
  const {
    shell,
    membershipMatrixGeneration,
    generateMembershipMatrix,
    clearMembershipMatrixGeneration,
  } = useApp();
  const capabilityRows = useMemo(() => deriveCapabilityRows(shell), [shell]);
  const coverage = useMemo(() => deriveCoverageSummary(capabilityRows), [capabilityRows]);

  const exchangeConnection = shell.exchangeConnection;
  const exchangeConnected = exchangeConnection?.state === "connected";
  const {
    groups,
    appliedKind,
    isLoading: groupsLoading,
    error: groupsError,
    refetch: refetchGroups,
  } = useExchangeGroupsQuery(exchangeConnection);

  const [selectedKind, setSelectedKind] = useState<ReportGroupKind>("all");

  const distributionCount = useMemo(
    () => groups.filter((g) => g.groupKind === "distributionList").length,
    [groups],
  );
  const securityCount = useMemo(
    () => groups.filter((g) => g.groupKind === "mailEnabledSecurityGroup").length,
    [groups],
  );

  const hasGroupsData = appliedKind !== null;
  const showGroupsError = groupsError !== null && !hasGroupsData;
  const showStaleGroupsError = groupsError !== null && hasGroupsData;

  const groupInventoryValue = !exchangeConnected
    ? "—"
    : groupsLoading
      ? "…"
      : showGroupsError
        ? "Error"
        : String(groups.length);

  const groupInventoryTrend = !exchangeConnected
    ? undefined
    : showGroupsError
      ? "Load failed"
      : groups.length > 0
        ? `${distributionCount} DL · ${securityCount} SG`
        : undefined;

  const coveragePercent =
    coverage.total > 0
      ? Math.round((coverage.available / coverage.total) * 100)
      : 0;

  const handleGenerate = useCallback(async () => {
    if (!exchangeConnected) return;
    await generateMembershipMatrix(selectedKind);
  }, [exchangeConnected, generateMembershipMatrix, selectedKind]);

  const handleRetry = useCallback(async () => {
    const retryKind = membershipMatrixGeneration.requestedKind ?? selectedKind;
    await generateMembershipMatrix(retryKind);
  }, [generateMembershipMatrix, membershipMatrixGeneration.requestedKind, selectedKind]);

  const handleReset = useCallback(() => {
    clearMembershipMatrixGeneration();
  }, [clearMembershipMatrixGeneration]);

  if (shell.isHydrating && !shell.session) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-8 text-[var(--color-primary)] animate-spin mr-3" />
          <span className="text-sm text-slate-500">Loading shell state…</span>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="py-6 flex justify-end">
          <div className="flex gap-2">
            {membershipMatrixGeneration.phase === "idle" && (
              <Button
                size="sm"
                className="text-xs"
                disabled={!exchangeConnected}
                onClick={() => void handleGenerate()}
              >
                <FileDown className="size-3.5 mr-1.5" />
                Generate Matrix
              </Button>
            )}
            {membershipMatrixGeneration.phase === "generating" && (
              <Button size="sm" className="text-xs" variant="outline" disabled>
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                Generating…
              </Button>
            )}
            {membershipMatrixGeneration.phase === "success" && (
              <Button size="sm" className="text-xs" variant="outline" onClick={handleReset}>
                <RefreshCw className="size-3.5 mr-1.5" />
                New Report
              </Button>
            )}
            {membershipMatrixGeneration.phase === "error" && (
              <Button size="sm" className="text-xs" onClick={() => void handleRetry()}>
                <RefreshCw className="size-3.5 mr-1.5" />
                Retry
              </Button>
            )}
          </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className={CONSOLE_SURFACE_CARD}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className={cn(
              "w-10 h-10 rounded flex items-center justify-center",
              exchangeConnected
                ? "bg-teal-50 text-[var(--color-primary)]"
                : "bg-slate-100 text-slate-400",
            )}>
              {exchangeConnected ? (
                <CheckCircle className="size-5" />
              ) : (
                <Ban className="size-5" />
              )}
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                Report & Export
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-[var(--color-foreground)]">
                  {exchangeConnected ? "Available" : "Unavailable"}
                </span>
                <StatusBadge
                  variant={exchangeConnected ? "success" : "error"}
                  size="sm"
                  className="text-[10px]"
                >
                  {exchangeConnected ? "Ready" : "No connection"}
                </StatusBadge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={CONSOLE_SURFACE_CARD}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded bg-teal-50 flex items-center justify-center text-[var(--color-primary)]">
              <CheckCircle className="size-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                Group Inventory
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-[var(--color-foreground)]">
                  {groupInventoryValue}
                </span>
                {groupInventoryTrend && (
                  <StatusBadge variant="neutral" size="sm" className="text-[10px]">
                    {groupInventoryTrend}
                  </StatusBadge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={CONSOLE_SURFACE_CARD}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded bg-teal-50 flex items-center justify-center text-[var(--color-primary)]">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                Workflow Coverage
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-[var(--color-foreground)]">
                  {coverage.available}/{coverage.total}
                </span>
                  <StatusBadge
                    variant={coveragePercent >= 70 ? "success" : coveragePercent >= 40 ? "warning" : "error"}
                    size="sm"
                    className="text-[10px]"
                  >
                    {coveragePercent}% available
                </StatusBadge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <div className="lg:col-span-3">
          <Card className={cn(CONSOLE_SURFACE_CARD, "overflow-hidden rounded-b-lg")}>
            <CardHeader className={CONSOLE_SURFACE_HEADER}>
              <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Capability & Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="text-[10px] uppercase tracking-wider font-bold">
                      Surface
                    </TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-bold">
                      Status
                    </TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-bold text-right">
                      Detail
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {capabilityRows.map((row) => {
                    const Icon = STATUS_ICON_MAP[row.status];
                    return (
                      <TableRow
                        key={row.id}
                        className="hover:bg-slate-50/30 transition-colors"
                      >
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Icon
                              className={cn(
                                "size-4",
                                row.status === "available"
                                  ? "text-[var(--color-primary)]"
                                  : row.status === "partial"
                                    ? "text-amber-500"
                                    : row.status === "deferred"
                                      ? "text-slate-400"
                                      : "text-[var(--color-tertiary)]",
                              )}
                            />
                            <span className="text-[12px] font-semibold text-slate-800">
                              {row.surface}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            variant={STATUS_VARIANT_MAP[row.status]}
                            size="sm"
                          >
                            {STATUS_LABEL_MAP[row.status]}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-right text-[11px] text-slate-500 font-medium">
                          {row.detail}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className={CONSOLE_SURFACE_CARD}>
            <CardHeader className={CONSOLE_SURFACE_HEADER_COMPACT}>
              <CardTitle className="text-xs font-bold text-slate-800">
                Membership Matrix
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {membershipMatrixGeneration.phase === "idle" && (
                <div className="flex flex-col gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Group Kind
                    </span>
                    <Select
                      value={selectedKind}
                      onValueChange={(v) => setSelectedKind(v as ReportGroupKind)}
                    >
                      <SelectTrigger size="sm" className="w-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">{KIND_LABELS.all}</SelectItem>
                          <SelectItem value="distributionList">{KIND_LABELS.distributionList}</SelectItem>
                          <SelectItem value="mailEnabledSecurityGroup">{KIND_LABELS.mailEnabledSecurityGroup}</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    className="w-full text-xs"
                    disabled={!exchangeConnected}
                    onClick={() => void handleGenerate()}
                  >
                    <FileDown className="size-3.5 mr-1.5" />
                    Generate Matrix
                  </Button>
                  {!exchangeConnected && (
                    <p className="text-[10px] text-slate-400 text-center">
                      Connect to Exchange to generate reports.
                    </p>
                  )}
                </div>
              )}

              {membershipMatrixGeneration.phase === "generating" && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-4 text-[var(--color-primary)] animate-spin shrink-0" />
                    <span className="text-xs font-semibold text-slate-700">
                      Generating…
                    </span>
                  </div>
                  <Progress value={membershipMatrixGeneration.progressPercent} className="h-1.5" />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span className="truncate mr-2">{membershipMatrixGeneration.progressMessage}</span>
                    <span className="shrink-0 font-medium">{membershipMatrixGeneration.progressPercent}%</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Export is in progress. You can leave this page and come back to see the latest progress.
                  </p>
                </div>
              )}

              {membershipMatrixGeneration.phase === "success" && membershipMatrixGeneration.result && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="size-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-700">
                      Report saved
                    </span>
                  </div>
                  <div className="bg-emerald-50 rounded-md p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="size-3.5 text-emerald-700 shrink-0" />
                      <span className="text-[11px] font-medium text-emerald-800 truncate" title={membershipMatrixGeneration.result.outputPath}>
                        {membershipMatrixGeneration.result.outputPath}
                      </span>
                    </div>
                    <div className="text-[10px] text-emerald-600">
                      {membershipMatrixGeneration.result.summary.groupCount} groups · {membershipMatrixGeneration.result.summary.recipientCount} recipients · {membershipMatrixGeneration.result.summary.membershipCount} memberships
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={handleReset}
                    >
                      New Report
                    </Button>
                  </div>
                </div>
              )}

              {membershipMatrixGeneration.phase === "error" && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="size-4 text-[var(--color-error)] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-700">
                        Generation failed
                      </p>
                        <p className="text-[11px] text-slate-500 break-words">
                          {membershipMatrixGeneration.error}
                        </p>
                      </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                       size="sm"
                       className="flex-1 text-xs"
                       onClick={() => void handleRetry()}
                     >
                      <RefreshCw className="size-3.5 mr-1.5" />
                      Retry
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                       onClick={() => void handleRetry()}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={CONSOLE_SURFACE_CARD}>
            <CardHeader className={CONSOLE_SURFACE_HEADER_COMPACT}>
              <CardTitle className="text-xs font-bold text-slate-800">
                Coverage
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-4">
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="font-semibold text-slate-600">Available</span>
                    <span className="text-slate-400">
                      {coverage.available}/{coverage.total}
                    </span>
                  </div>
                  <div className="h-1 w-full bg-slate-100 rounded-full">
                    <div
                      className="h-full bg-[var(--color-primary)] rounded-full"
                      style={{ width: `${coveragePercent}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="font-semibold text-slate-600">Deferred</span>
                    <span className="text-slate-400">{coverage.deferred}</span>
                  </div>
                  <div className="h-1 w-full bg-slate-100 rounded-full">
                    <div
                      className="h-full bg-slate-300 rounded-full"
                      style={{
                        width: `${coverage.total > 0 ? Math.round((coverage.deferred / coverage.total) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={CONSOLE_SURFACE_CARD}>
            <CardHeader className={CONSOLE_SURFACE_HEADER_COMPACT}>
              <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Deferred Capabilities
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-3">
              <ul className="space-y-2">
                {capabilityRows
                  .filter((r) => r.status === "deferred")
                  .map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between group"
                    >
                      <span className="text-[11px] font-medium text-slate-700">
                        {row.surface}
                      </span>
                      <StatusBadge variant="neutral" size="sm" dotOnly />
                    </li>
                  ))}
                {capabilityRows.filter((r) => r.status === "deferred").length === 0 && (
                  <li className="text-[11px] text-slate-400">
                    No deferred capabilities
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>

          {exchangeConnected && groupsError && (
            <Card className={cn(CONSOLE_SURFACE_CARD, "border-[var(--color-error)]/20")}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                <AlertCircle className="size-4 text-[var(--color-error)] shrink-0" />
                <div>
                  <p className="text-[11px] font-bold text-slate-700">
                    {showStaleGroupsError ? "Group inventory may be stale" : "Group inventory failed"}
                  </p>
                  <p className="text-[10px] text-slate-400">{groupsError}</p>
                </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-[10px]"
                  onClick={() => void refetchGroups()}
                >
                  Retry
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
