import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  AlertCircle,
  FileText,
  RefreshCw,
  ChevronDown,
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
  CardContent,
  CardHeader,
  CardTitle,
} from "@/renderer/components/ui/card";
import { Button } from "@/renderer/components/ui/button";
import { Badge } from "@/renderer/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/renderer/components/ui/select";
import { Input } from "@/renderer/components/ui/input";
import {
  CONSOLE_SURFACE_CARD,
  CONSOLE_SURFACE_HEADER_COMPACT,
} from "@/renderer/components/console/surface-styles";
import { cn } from "@/renderer/lib/utils";
import type { AuditResult, AuditScope, AuditEventItem } from "@/shared/contracts/audit";

export type AuditEventsPanelMode = "screen" | "embedded";

export interface AuditEventsPanelProps {
  mode: AuditEventsPanelMode;
  scope: AuditScope;
  className?: string;
}

const OPERATION_TYPE_OPTIONS = [
  { value: "all", label: "All Operations" },
  { value: "groups.addMembers", label: "Add Members" },
  { value: "groups.removeMembers", label: "Remove Members" },
  { value: "contacts.create", label: "Create Contact" },
  { value: "contacts.updateCompany", label: "Update Contact Company" },
  { value: "guests.invite", label: "Invite Guest" },
  { value: "guests.updateCompany", label: "Update Guest Company" },
];

const RESULT_OPTIONS = [
  { value: "all", label: "All Results" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "partial", label: "Partial" },
];

const RESULT_VARIANT_MAP: Record<AuditResult, "success" | "destructive" | "warning" | "secondary"> = {
  succeeded: "success",
  failed: "destructive",
  partial: "warning",
};

function formatTimestamp(isoUtc: string): string {
  try {
    const date = new Date(isoUtc);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return isoUtc;
  }
}

function truncateId(id: string, maxLen: number = 12): string {
  if (id.length <= maxLen) return id;
  return id.slice(0, maxLen) + "…";
}

export function AuditEventsPanel({
  mode,
  scope,
  className,
}: AuditEventsPanelProps) {
  const [events, setEvents] = useState<AuditEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [operationType, setOperationType] = useState("all");
  const [resultFilter, setResultFilter] = useState<AuditResult | "all">("all");
  const [searchFilter, setSearchFilter] = useState("");

  const requestIdRef = useRef(0);

  const isScreen = mode === "screen";

  const loadEvents = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    setEvents([]);
    setNextCursor(null);

    try {
      const result = await window.radApp.audit.listEvents({
        scope,
        pageSize: isScreen ? 50 : 25,
        query: searchFilter.trim() || undefined,
        operationType: operationType !== "all" ? operationType : undefined,
        result: resultFilter !== "all" ? (resultFilter as AuditResult) : undefined,
      });

      if (requestIdRef.current !== requestId) return;

      setEvents(result.items);
      setNextCursor(result.nextCursor);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      const message = err instanceof Error ? err.message : "Failed to load audit events.";
      setError(message);
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [scope, isScreen, operationType, resultFilter, searchFilter]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const requestId = requestIdRef.current;
    setLoadingMore(true);

    try {
      const result = await window.radApp.audit.listEvents({
        scope,
        cursor: nextCursor,
        pageSize: isScreen ? 50 : 25,
        query: searchFilter.trim() || undefined,
        operationType: operationType !== "all" ? operationType : undefined,
        result: resultFilter !== "all" ? (resultFilter as AuditResult) : undefined,
      });

      if (requestId !== requestIdRef.current) return;

      setEvents((prev) => [...prev, ...result.items]);
      setNextCursor(result.nextCursor);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      const message = err instanceof Error ? err.message : "Failed to load more events.";
      setError(message);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingMore(false);
      }
    }
  }, [scope, nextCursor, loadingMore, isScreen, operationType, resultFilter, searchFilter]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
    };
  }, []);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-16", className)}>
        <Loader2 className="size-6 text-[var(--color-primary)] animate-spin mr-2" />
        <span className="text-sm text-slate-500">Loading audit events…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-16", className)}>
        <AlertCircle className="size-8 text-[var(--color-error)] mb-3" />
        <p className="text-sm font-bold text-slate-700 mb-1">Failed to load audit events</p>
        <p className="text-xs text-slate-500 max-w-sm mb-3">{error}</p>
        <Button size="sm" onClick={() => void loadEvents()}>
          <RefreshCw className="size-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  if (isScreen) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Input
              className="bg-slate-100 border-none text-[11px] rounded-full pl-3 pr-3 py-1"
              placeholder="Filter events…"
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>
          <Select value={operationType} onValueChange={setOperationType}>
            <SelectTrigger size="sm" className="bg-white border-slate-200 text-[11px] w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {OPERATION_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            value={resultFilter}
            onValueChange={(value) => setResultFilter(value as AuditResult | "all")}
          >
            <SelectTrigger size="sm" className="bg-white border-slate-200 text-[11px] w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {RESULT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="text-[11px]"
            onClick={() => void loadEvents()}
          >
            <RefreshCw className="size-3 mr-1" />
            Refresh
          </Button>
        </div>

        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FileText className="size-10 text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-700 mb-1">No audit events found</p>
            <p className="text-xs text-slate-500 max-w-sm">
              {scope.kind === "all"
                ? "Audit events will appear here as operations are performed."
                : "No audit events found for this object."}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white border border-slate-200/60 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="text-[10px] uppercase tracking-wider font-bold">
                      Time
                    </TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-bold">
                      Operation
                    </TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-bold">
                      Actor
                    </TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-bold">
                      Target
                    </TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-bold">
                      Summary
                    </TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-bold text-right">
                      Result
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow
                      key={event.operationId + event.timestamp}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <TableCell className="text-[11px] text-slate-500 whitespace-nowrap">
                        {formatTimestamp(event.timestamp)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5">
                          {event.operationType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[11px] text-slate-600 font-medium max-w-[140px] truncate">
                        {event.actorUpn ?? "—"}
                      </TableCell>
                      <TableCell className="text-[11px] text-slate-600 font-mono max-w-[120px] truncate">
                        {event.targetObjectId ? truncateId(event.targetObjectId) : "—"}
                      </TableCell>
                      <TableCell className="text-[11px] text-slate-500 max-w-[240px] truncate">
                        {event.summary}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            RESULT_VARIANT_MAP[event.result] ?? "secondary"
                          }
                          className="text-[9px] px-1.5 py-0.5"
                        >
                          {event.result}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {nextCursor && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                >
                  {loadingMore && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
                  <ChevronDown className="size-3.5 mr-1" />
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <Card className={cn(CONSOLE_SURFACE_CARD, className)}>
      <CardHeader className={CONSOLE_SURFACE_HEADER_COMPACT}>
        <div className="flex items-center justify-between w-full">
          <CardTitle className="text-sm font-bold text-slate-800">
            Audit Events
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-[11px] text-slate-500 hover:text-[var(--color-primary)]"
            onClick={() => void loadEvents()}
          >
            <RefreshCw className="size-3 mr-1" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-3">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <FileText className="size-8 text-slate-300 mb-2" />
            <p className="text-xs font-bold text-slate-700 mb-1">No audit events</p>
            <p className="text-[11px] text-slate-400 max-w-xs text-center">
              {scope.kind === "all"
                ? "Audit events will appear here as operations are performed."
                : "No audit events found for this group."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto -mx-4 px-4">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px]">Time</TableHead>
                    <TableHead className="text-[10px]">Operation</TableHead>
                    <TableHead className="text-[10px]">Actor</TableHead>
                    <TableHead className="text-[10px]">Summary</TableHead>
                    <TableHead className="text-[10px] text-right">Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow
                      key={event.operationId + event.timestamp}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <TableCell className="text-[11px] text-slate-500 whitespace-nowrap">
                        {formatTimestamp(event.timestamp)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5">
                          {event.operationType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[11px] text-slate-600 font-medium max-w-[120px] truncate">
                        {event.actorUpn ?? "—"}
                      </TableCell>
                      <TableCell className="text-[11px] text-slate-500 max-w-[200px] truncate">
                        {event.summary}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={RESULT_VARIANT_MAP[event.result] ?? "secondary"}
                          className="text-[9px] px-1.5 py-0.5"
                        >
                          {event.result}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {nextCursor && (
              <div className="flex justify-center mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[11px] text-[var(--color-primary)]"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                >
                  {loadingMore && <Loader2 className="size-3 mr-1 animate-spin" />}
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
