import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  AlertCircle,
  FileText,
  RefreshCw,
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
  CONSOLE_SURFACE_CARD,
  CONSOLE_SURFACE_HEADER_COMPACT,
} from "@/renderer/components/console/surface-styles";
import { cn } from "@/renderer/lib/utils";
import type {
  SystemLogEventItem,
  SystemLogResult,
  SystemLogScope,
} from "@/shared/contracts/system-logs";

export type SystemLogsPanelMode = "screen" | "embedded";

export interface SystemLogsPanelProps {
  scope: SystemLogScope;
  className?: string;
}

const RESULT_VARIANT_MAP: Record<SystemLogResult, "success" | "destructive" | "warning" | "secondary"> = {
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

export function SystemLogsPanel({
  scope,
  className,
}: SystemLogsPanelProps) {
  const [events, setEvents] = useState<SystemLogEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestIdRef = useRef(0);

  const loadEvents = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    setEvents([]);
    setNextCursor(null);

    try {
      const result = await window.radApp.systemLogs.listEvents({
        scope,
        pageSize: 25,
      });

      if (requestIdRef.current !== requestId) return;

      setEvents(result.items);
      setNextCursor(result.nextCursor);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      const message = err instanceof Error ? err.message : "Failed to load system logs.";
      setError(message);
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [scope]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const requestId = requestIdRef.current;
    setLoadingMore(true);

    try {
      const result = await window.radApp.systemLogs.listEvents({
        scope,
        cursor: nextCursor,
        pageSize: 25,
      });

      if (requestId !== requestIdRef.current) return;

      setEvents((prev) => [...prev, ...result.items]);
      setNextCursor(result.nextCursor);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      const message = err instanceof Error ? err.message : "Failed to load more logs.";
      setError(message);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingMore(false);
      }
    }
  }, [scope, nextCursor, loadingMore]);

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
        <span className="text-sm text-slate-500">Loading system logs…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-16", className)}>
        <AlertCircle className="size-8 text-[var(--color-error)] mb-3" />
        <p className="text-sm font-bold text-slate-700 mb-1">Failed to load system logs</p>
        <p className="text-xs text-slate-500 max-w-sm mb-3">{error}</p>
        <Button size="sm" onClick={() => void loadEvents()}>
          <RefreshCw className="size-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Card className={cn(CONSOLE_SURFACE_CARD, className)}>
      <CardHeader className={CONSOLE_SURFACE_HEADER_COMPACT}>
        <div className="flex items-center justify-between w-full">
          <CardTitle className="text-sm font-bold text-slate-800">
            System Logs
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
            <p className="text-xs font-bold text-slate-700 mb-1">No system logs</p>
            <p className="text-[11px] text-slate-400 max-w-xs text-center">
              {scope.kind === "all"
                ? "System logs will appear here as operations are performed."
                : "No system logs found for this group."}
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
