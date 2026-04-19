import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { StatusBadge } from "@/renderer/components/console";
import { AppShell, PageHeader } from "@/renderer/components/console";
import {
  CONSOLE_SURFACE_CARD,
  CONSOLE_SURFACE_HEADER,
  CONSOLE_SURFACE_HEADER_COMPACT,
} from "@/renderer/components/console/surface-styles";
import { cn } from "@/renderer/lib/utils";
import { useApp } from "@/renderer/components/console/app-context";
import {
  deriveCapabilityRows,
  deriveCoverageSummary,
  type CapabilityStatus,
} from "@/renderer/components/console/reports-coverage";
import type { ExchangeGroupListItem } from "@/shared/contracts/exchange";
import type {
  ReportGroupKind,
  ReportsGenerateMembershipMatrixResult,
} from "@/shared/contracts/reports";
import type { ProgressEvent } from "@/shared/contracts/command";

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

type GenerationPhase = "idle" | "generating" | "success" | "error";

export function ReportsScreen() {
  const { shell } = useApp();
  const capabilityRows = useMemo(() => deriveCapabilityRows(shell), [shell]);
  const coverage = useMemo(() => deriveCoverageSummary(capabilityRows), [capabilityRows]);

  const exchangeConnected = shell.exchangeConnection?.state === "connected";

  const [groups, setGroups] = useState<ExchangeGroupListItem[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [hasLoadedGroups, setHasLoadedGroups] = useState(false);

  const [selectedKind, setSelectedKind] = useState<ReportGroupKind>("all");
  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>("idle");
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [generationResult, setGenerationResult] = useState<ReportsGenerateMembershipMatrixResult | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const activeRequestIdRef = useRef(0);

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

  const distributionCount = useMemo(
    () => groups.filter((g) => g.groupKind === "distributionList").length,
    [groups],
  );
  const securityCount = useMemo(
    () => groups.filter((g) => g.groupKind === "mailEnabledSecurityGroup").length,
    [groups],
  );

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

  const coveragePercent =
    coverage.total > 0
      ? Math.round((coverage.available / coverage.total) * 100)
      : 0;

  const handleGenerate = useCallback(async () => {
    if (!exchangeConnected) return;

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    setGenerationPhase("generating");
    setProgressMessage("Starting…");
    setProgressPercent(0);
    setGenerationResult(null);
    setGenerationError(null);

    try {
      const result = await window.radApp.reports.generateMembershipMatrix(
        { kind: selectedKind },
        (event: ProgressEvent) => {
          if (activeRequestIdRef.current !== requestId) return;
          setProgressMessage(event.message);
          if (event.percent !== undefined) {
            setProgressPercent(event.percent);
          }
        },
      );

      if (activeRequestIdRef.current === requestId) {
        setGenerationResult(result);
        setGenerationPhase("success");
      }
    } catch (err) {
      if (activeRequestIdRef.current === requestId) {
        const message = err instanceof Error ? err.message : "Report generation failed.";
        setGenerationError(message);
        setGenerationPhase("error");
      }
    }
  }, [exchangeConnected, selectedKind]);

  const handleRetry = useCallback(() => {
    setGenerationPhase("idle");
    setGenerationError(null);
    setProgressMessage("");
    setProgressPercent(0);
  }, []);

  const handleReset = useCallback(() => {
    activeRequestIdRef.current += 1;
    setGenerationPhase("idle");
    setGenerationResult(null);
    setGenerationError(null);
    setProgressMessage("");
    setProgressPercent(0);
  }, []);

  useEffect(() => {
    return () => {
      activeRequestIdRef.current += 1;
    };
  }, []);

  if (shell.isHydrating && !shell.session) {
    return (
      <AppShell>
        <PageHeader
          title="Reports"
          description="Capability status and export inventory."
        />
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
        title="Reports"
        description="Capability status and export inventory."
        actions={
          <div className="flex gap-2">
            {generationPhase === "idle" && (
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
            {generationPhase === "generating" && (
              <Button size="sm" className="text-xs" variant="outline" disabled>
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                Generating…
              </Button>
            )}
            {generationPhase === "success" && (
              <Button size="sm" className="text-xs" variant="outline" onClick={handleReset}>
                <RefreshCw className="size-3.5 mr-1.5" />
                New Report
              </Button>
            )}
            {generationPhase === "error" && (
              <Button size="sm" className="text-xs" onClick={() => void handleGenerate()}>
                <RefreshCw className="size-3.5 mr-1.5" />
                Retry
              </Button>
            )}
          </div>
        }
      />

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
              {generationPhase === "idle" && (
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

              {generationPhase === "generating" && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-4 text-[var(--color-primary)] animate-spin shrink-0" />
                    <span className="text-xs font-semibold text-slate-700">
                      Generating…
                    </span>
                  </div>
                  <Progress value={progressPercent} className="h-1.5" />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span className="truncate mr-2">{progressMessage}</span>
                    <span className="shrink-0 font-medium">{progressPercent}%</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Export is in progress. This view will update when the current request finishes.
                  </p>
                </div>
              )}

              {generationPhase === "success" && generationResult && (
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
                      <span className="text-[11px] font-medium text-emerald-800 truncate" title={generationResult.outputPath}>
                        {generationResult.outputPath}
                      </span>
                    </div>
                    <div className="text-[10px] text-emerald-600">
                      {generationResult.summary.groupCount} groups · {generationResult.summary.recipientCount} recipients · {generationResult.summary.membershipCount} memberships
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

              {generationPhase === "error" && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="size-4 text-[var(--color-error)] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-700">
                        Generation failed
                      </p>
                      <p className="text-[11px] text-slate-500 break-words">
                        {generationError}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => void handleGenerate()}
                    >
                      <RefreshCw className="size-3.5 mr-1.5" />
                      Retry
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={handleRetry}
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
              <CardContent className="p-4 flex items-center gap-3">
                <AlertCircle className="size-4 text-[var(--color-error)] shrink-0" />
                <div>
                  <p className="text-[11px] font-bold text-slate-700">
                    Group inventory failed
                  </p>
                  <p className="text-[10px] text-slate-400">{groupsError}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
