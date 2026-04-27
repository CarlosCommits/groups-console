import { useState, useCallback, useMemo } from "react";
import {
  AlertCircle,
  CheckCircle,
  FileDown,
  FolderOpen,
  Loader2,
  RefreshCw,
} from "lucide-react";
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
} from "@/renderer/components/console/surface-styles";
import { cn } from "@/renderer/lib/utils";
import { useApp } from "@/renderer/components/console/app-context";
import { useExchangeGroupsQuery } from "@/renderer/hooks/use-exchange-groups";
import type { ReportGroupKind } from "@/shared/contracts/reports";

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

  const inventorySummary = !exchangeConnected
    ? "Connect to Exchange to load group inventory."
    : groupsLoading
      ? "Loading group inventory..."
      : showGroupsError
        ? "Group inventory failed to load."
        : `${groups.length} groups available (${distributionCount} DL, ${securityCount} SG).`;

  const handleGenerate = useCallback(async () => {
    if (!exchangeConnected || membershipMatrixGeneration.phase === "generating") return;
    await generateMembershipMatrix(selectedKind);
  }, [exchangeConnected, generateMembershipMatrix, membershipMatrixGeneration.phase, selectedKind]);

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
          <span className="text-sm text-slate-500">Loading shell state...</span>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-4xl space-y-5">
        <Card className={cn(CONSOLE_SURFACE_CARD, "overflow-hidden")}>
          <CardHeader className={CONSOLE_SURFACE_HEADER}>
            <div>
              <CardTitle className="text-sm font-extrabold font-headline">
                Membership Matrix
              </CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                Export group membership coverage to an Excel workbook.
              </p>
            </div>
            <StatusBadge
              variant={exchangeConnected ? "success" : "neutral"}
              size="sm"
            >
              {exchangeConnected ? "Ready" : "Exchange required"}
            </StatusBadge>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
              <div className="space-y-4">
                <div className="rounded-md border border-[var(--color-outline-variant)]/20 bg-slate-50/70 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Group Inventory
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    {inventorySummary}
                  </p>
                </div>

                {membershipMatrixGeneration.phase === "generating" && (
                  <div className="space-y-3 rounded-md border border-[var(--color-outline-variant)]/20 p-4">
                    <div className="flex items-center gap-2">
                      <Loader2 className="size-4 text-[var(--color-primary)] animate-spin shrink-0" />
                      <span className="text-sm font-semibold text-slate-700">
                        Generating report
                      </span>
                    </div>
                    <Progress value={membershipMatrixGeneration.progressPercent} className="h-1.5" />
                    <div className="flex justify-between text-xs text-slate-500">
                      <span className="truncate pr-3">{membershipMatrixGeneration.progressMessage}</span>
                      <span className="shrink-0 font-medium">{membershipMatrixGeneration.progressPercent}%</span>
                    </div>
                  </div>
                )}

                {membershipMatrixGeneration.phase === "success" && membershipMatrixGeneration.result && (
                  <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="size-4 text-emerald-600 shrink-0" />
                      <span className="text-sm font-semibold text-emerald-900">
                        Report saved
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FolderOpen className="size-3.5 text-emerald-700 shrink-0" />
                      <span className="truncate text-xs font-medium text-emerald-800" title={membershipMatrixGeneration.result.outputPath}>
                        {membershipMatrixGeneration.result.outputPath}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-700">
                      {membershipMatrixGeneration.result.summary.groupCount} groups, {membershipMatrixGeneration.result.summary.recipientCount} recipients, {membershipMatrixGeneration.result.summary.membershipCount} memberships
                    </p>
                  </div>
                )}

                {membershipMatrixGeneration.phase === "error" && (
                  <div className="space-y-3 rounded-md border border-red-200 bg-red-50 p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="size-4 text-[var(--color-error)] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">
                          Generation failed
                        </p>
                        <p className="text-xs text-slate-600 break-words">
                          {membershipMatrixGeneration.error}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="text-xs" onClick={() => void handleRetry()}>
                        <RefreshCw className="size-3.5 mr-1.5" />
                        Retry
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs" onClick={handleReset}>
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}

                {exchangeConnected && groupsError && (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200/70 bg-amber-50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-amber-900">
                        {showStaleGroupsError ? "Group inventory may be stale" : "Group inventory failed"}
                      </p>
                      <p className="truncate text-[11px] text-amber-800/80">{groupsError}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-xs"
                      onClick={() => void refetchGroups()}
                    >
                      Retry
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-md border border-[var(--color-outline-variant)]/20 p-4">
                <div>
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Group Kind
                  </span>
                  <Select
                    value={selectedKind}
                    onValueChange={(value) => setSelectedKind(value as ReportGroupKind)}
                    disabled={membershipMatrixGeneration.phase === "generating"}
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
                  disabled={!exchangeConnected || membershipMatrixGeneration.phase === "generating"}
                  onClick={() => void handleGenerate()}
                >
                  {membershipMatrixGeneration.phase === "generating" ? (
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <FileDown className="size-3.5 mr-1.5" />
                  )}
                  {membershipMatrixGeneration.phase === "generating" ? "Generating" : "Generate Matrix"}
                </Button>

                {membershipMatrixGeneration.phase === "success" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={handleReset}
                  >
                    <RefreshCw className="size-3.5 mr-1.5" />
                    New Report
                  </Button>
                )}

                {!exchangeConnected && (
                  <p className="text-center text-[11px] text-slate-400">
                    Connect to Exchange to generate reports.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
