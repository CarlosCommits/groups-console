import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  RefreshCw,
  UserPlus,
  Shield,
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
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectContent,
} from "@/renderer/components/ui/select";
import { Button } from "@/renderer/components/ui/button";
import { StatusBadge } from "@/renderer/components/console";
import { AppShell, PageHeader } from "@/renderer/components/console";
import {
  CONSOLE_SURFACE_CARD,
  CONSOLE_SURFACE_HEADER,
  CONSOLE_SURFACE_HEADER_COMPACT,
} from "@/renderer/components/console/surface-styles";
import { cn } from "@/renderer/lib/utils";

interface ReportEvent {
  id: number;
  icon: typeof RefreshCw;
  title: string;
  description: string;
  type: "sync" | "security" | "cleanup";
  range: "24h" | "7d" | "custom";
  status: "success" | "pending" | "warning" | "error";
  timestamp: string;
}

const reportStats = [
  {
    icon: Activity,
    label: "Directory Health",
    value: "Stable",
    subvalue: "98.2%",
    variant: "success" as const,
  },
  {
    icon: AlertTriangle,
    label: "Critical Alerts",
    value: "03",
    subvalue: "2m ago",
    variant: "warning" as const,
  },
  {
    icon: Shield,
    label: "Active Groups",
    value: "1,284",
    subvalue: "+12%",
    variant: "neutral" as const,
  },
];

const reportEvents: ReportEvent[] = [
  { id: 1, icon: RefreshCw, title: "Directory Sync Initiated", description: "Azure AD Connector", type: "sync", range: "24h", status: "success", timestamp: "Today, 09:42 AM" },
  { id: 2, icon: UserPlus, title: "Bulk Group Assignment", description: "m.weaver@console.com", type: "cleanup", range: "custom", status: "pending", timestamp: "Today, 08:15 AM" },
  { id: 3, icon: Shield, title: "Policy Breach Detected", description: "Finance-External", type: "security", range: "7d", status: "error", timestamp: "Today, 07:30 AM" },
];

const tasks = [
  { id: 1, label: "Refresh Cache" },
  { id: 2, label: "Prune Meta" },
  { id: 3, label: "Recalc Sizes" },
];

export function ReportsScreen() {
  const [timeRange, setTimeRange] = useState("24h");
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventType, setEventType] = useState("all-types");

  const filteredEvents = reportEvents.filter((event) => {
    const matchesRange =
      timeRange === "24h"
        ? event.range === "24h"
        : timeRange === "7d"
          ? event.range === "24h" || event.range === "7d"
          : event.range === "custom";

    const matchesStatus =
      statusFilter === "all" || event.status === statusFilter;
    const matchesType = eventType === "all-types" || event.type === eventType;

    return matchesRange && matchesStatus && matchesType;
  });

  const resetFilters = () => {
    setTimeRange("24h");
    setStatusFilter("all");
    setEventType("all-types");
  };

  return (
    <AppShell>
      <PageHeader
        title="Reports"
        description="System health, activity audit, and directory analytics."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs">
              Export CSV
            </Button>
            <Button size="sm" className="text-xs">
              Generate Audit
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        {reportStats.map((stat) => (
          <Card key={stat.label} className={CONSOLE_SURFACE_CARD}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded bg-teal-50 flex items-center justify-center text-[var(--color-primary)]">
                <stat.icon className="size-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  {stat.label}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-[var(--color-foreground)]">
                    {stat.value}
                  </span>
                  <StatusBadge
                    variant={stat.variant}
                    size="sm"
                    className="text-[10px]"
                  >
                    {stat.subvalue}
                  </StatusBadge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <div className="lg:col-span-3">
          <Card className={cn(CONSOLE_SURFACE_CARD, "overflow-hidden rounded-b-lg")}>
            <CardHeader className={CONSOLE_SURFACE_HEADER}>
              <div className="flex items-center gap-4">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Filters
                </span>
                <div className="flex gap-2">
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger size="sm" className="bg-slate-50 border-slate-200 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="24h">Last 24 Hours</SelectItem>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger size="sm" className="bg-slate-50 border-slate-200 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Select value={eventType} onValueChange={setEventType}>
                    <SelectTrigger size="sm" className="bg-slate-50 border-slate-200 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all-types">Event Type: All</SelectItem>
                        <SelectItem value="sync">Sync</SelectItem>
                        <SelectItem value="security">Security</SelectItem>
                        <SelectItem value="cleanup">Cleanup</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="text-[11px] font-bold text-[var(--color-primary)] uppercase tracking-widest h-auto p-0"
              >
                Clear All
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="text-[10px] uppercase tracking-wider font-bold">
                      Event / Source
                    </TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-bold">
                      Status
                    </TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-bold text-right">
                      Timestamp
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow
                      key={event.id}
                      className="hover:bg-teal-50/30 transition-colors"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <event.icon
                            className={cn(
                              "size-4",
                              event.status === "success"
                                ? "text-[var(--color-primary)]"
                                : event.status === "pending"
                                ? "text-slate-400"
                                : "text-[var(--color-tertiary)]"
                            )}
                          />
                          <div>
                            <div className="text-[12px] font-semibold text-slate-800">
                              {event.title}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {event.description}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          variant={
                            event.status === "success"
                              ? "success"
                              : event.status === "pending"
                              ? "neutral"
                              : event.status === "warning"
                              ? "warning"
                              : "error"
                          }
                          size="sm"
                        >
                          {event.status}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-right text-[11px] text-slate-500 font-medium">
                        {event.timestamp}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className={CONSOLE_SURFACE_CARD}>
            <CardHeader className={CONSOLE_SURFACE_HEADER_COMPACT}>
              <CardTitle className="text-xs font-bold text-slate-800">
                Directory Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-4">
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="font-semibold text-slate-600">Azure AD</span>
                    <span className="text-slate-400">65%</span>
                  </div>
                  <div className="h-1 w-full bg-slate-100 rounded-full">
                    <div className="h-full bg-[var(--color-primary)] rounded-full" style={{ width: "65%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="font-semibold text-slate-600">Google Workspace</span>
                    <span className="text-slate-400">28%</span>
                  </div>
                  <div className="h-1 w-full bg-slate-100 rounded-full">
                    <div className="h-full bg-[var(--color-secondary)] rounded-full" style={{ width: "28%" }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={CONSOLE_SURFACE_CARD}>
            <CardHeader className={CONSOLE_SURFACE_HEADER_COMPACT}>
              <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-3">
              <ul className="space-y-2">
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center justify-between group cursor-pointer"
                  >
                    <span className="text-[11px] font-medium text-slate-700 group-hover:text-[var(--color-primary)]">
                      {task.label}
                    </span>
                    <StatusBadge variant="neutral" size="sm" dotOnly />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
