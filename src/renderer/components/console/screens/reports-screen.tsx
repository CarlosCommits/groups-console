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
import { Button } from "@/renderer/components/ui/button";
import { StatusBadge } from "@/renderer/components/console";
import { AppShell } from "@/renderer/components/console";
import { cn } from "@/renderer/lib/utils";

interface ReportEvent {
  id: number;
  icon: typeof RefreshCw;
  title: string;
  description: string;
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
  { id: 1, icon: RefreshCw, title: "Directory Sync Initiated", description: "Azure AD Connector", status: "success", timestamp: "Today, 09:42 AM" },
  { id: 2, icon: UserPlus, title: "Bulk Group Assignment", description: "m.weaver@console.com", status: "pending", timestamp: "Today, 08:15 AM" },
  { id: 3, icon: Shield, title: "Policy Breach Detected", description: "Finance-External", status: "error", timestamp: "Today, 07:30 AM" },
];

const tasks = [
  { id: 1, label: "Refresh Cache" },
  { id: 2, label: "Prune Meta" },
  { id: 3, label: "Recalc Sizes" },
];

export function ReportsScreen() {
  return (
    <AppShell>
      <header className="mb-5 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold font-headline tracking-tight text-[var(--color-foreground)]">
            Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            System health, activity audit, and directory analytics.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-xs">
            Export CSV
          </Button>
          <Button size="sm" className="text-xs">
            Generate Audit
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {reportStats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4"
          >
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
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <div className="lg:col-span-3">
          <div className="bg-white border border-slate-200 rounded-t-lg px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Filters
              </span>
              <div className="flex gap-2">
                <select className="bg-slate-50 border border-slate-200 text-[11px] py-1 rounded-md outline-none">
                  <option>Last 24 Hours</option>
                  <option>Last 7 Days</option>
                  <option>Custom Range</option>
                </select>
                <select className="bg-slate-50 border border-slate-200 text-[11px] py-1 rounded-md outline-none">
                  <option>All Statuses</option>
                  <option>Success</option>
                  <option>Warning</option>
                  <option>Pending</option>
                </select>
                <select className="bg-slate-50 border border-slate-200 text-[11px] py-1 rounded-md outline-none">
                  <option>Event Type: All</option>
                  <option>Sync</option>
                  <option>Security</option>
                  <option>Cleanup</option>
                </select>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-[11px] font-bold text-[var(--color-primary)] uppercase tracking-widest h-auto p-0">
              Clear All
            </Button>
          </div>

          <div className="bg-white border-x border-b border-slate-200 rounded-b-lg overflow-hidden shadow-sm">
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
                {reportEvents.map((event) => (
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
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <h3 className="text-xs font-bold text-slate-800 mb-4">
              Directory Distribution
            </h3>
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
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
              Tasks
            </h3>
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
          </div>
        </div>
      </div>
    </AppShell>
  );
}
