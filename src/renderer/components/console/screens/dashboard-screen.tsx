import {
  Users,
  UserPlus,
  Contact,
  UserSearch,
  RefreshCw,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  XCircle,
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
import { AppShell, PageHeader, StatCard, StatusBadge } from "@/renderer/components/console";
import {
  CONSOLE_SURFACE_CARD,
  CONSOLE_SURFACE_HEADER,
  CONSOLE_SURFACE_HEADER_COMPACT,
} from "@/renderer/components/console/surface-styles";
import { cn } from "@/renderer/lib/utils";

const recentActivity = [
  {
    id: 1,
    icon: RefreshCw,
    title: "Policy Update: Compliance-A",
    user: "Sarah Miller",
    time: "14:22 PM",
    status: "success",
  },
  {
    id: 2,
    icon: UserPlus,
    title: "Member Added: Engineering-Leads",
    user: "Alex Rivera",
    time: "12:05 PM",
    status: "success",
  },
  {
    id: 3,
    icon: AlertCircle,
    title: "Sync Failure: Finance-External",
    user: "System Process",
    time: "09:45 AM",
    status: "failed",
  },
];

const attentionItems = [
  {
    id: 1,
    type: "error",
    icon: XCircle,
    title: "Marketing-Global: Sync Failure",
    description: "Naming policy conflict in Exchange Online.",
    action: "Resolve",
  },
  {
    id: 2,
    icon: UserSearch,
    title: "Group Access: 3 Requests",
    description: "Infrastructure core access pending review.",
    action: "Review All",
  },
];

const shortcuts = [
  { id: "open-groups", icon: Users, label: "Open Groups" },
  { id: "search-directory", icon: UserSearch, label: "Search Directory" },
  { id: "create-contact", icon: Contact, label: "Create Contact" },
  { id: "invite-guest", icon: UserPlus, label: "Invite Guest" },
  { id: "refresh-sessions", icon: RefreshCw, label: "Refresh Sessions" },
];

export function DashboardScreen() {
  return (
    <AppShell>
      <PageHeader
        title="System Home"
        description="Operational summary and quick management utilities."
      />

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8 space-y-5">
          <section className="grid grid-cols-3 gap-3">
            <StatCard
              label="Total Groups"
              value="1,248"
              trend="+12 today"
              trendType="success"
            />
            <StatCard
              label="Directory Size"
              value="8.4k"
              trend="Contacts"
              trendType="neutral"
            />
            <StatCard
              label="Sync Status"
              value="Health Optimal"
              trendType="success"
            />
          </section>

          <Card className={cn(CONSOLE_SURFACE_CARD, "overflow-hidden")}>
            <CardHeader
              className={cn(
                CONSOLE_SURFACE_HEADER,
                "bg-[var(--color-surface-container-low)] py-2.5"
              )}
            >
              <CardTitle className="text-xs font-extrabold font-headline flex items-center gap-2 uppercase tracking-wide text-[var(--color-foreground)]">
                <AlertCircle className="size-4 text-[var(--color-tertiary)]" />
                Attention Required
              </CardTitle>
              <StatusBadge variant="warning" size="sm">
                4 Pending Issues
              </StatusBadge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-[var(--color-outline-variant)]/10">
                {attentionItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-8 h-8 rounded flex items-center justify-center",
                          item.type === "error"
                            ? "bg-[var(--color-error-container)]/20"
                            : "bg-[var(--color-primary)]/10"
                        )}
                      >
                        <item.icon
                          className={cn(
                            "size-[18px]",
                            item.type === "error"
                              ? "text-[var(--color-error)]"
                              : "text-[var(--color-primary)]"
                          )}
                        />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold">{item.title}</h3>
                        <p className="text-[11px] text-[var(--color-outline)]">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="text-[10px] font-bold">
                      {item.action}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className={CONSOLE_SURFACE_CARD}>
            <CardHeader className={CONSOLE_SURFACE_HEADER}>
              <CardTitle className="text-sm font-extrabold font-headline">Recent Activity</CardTitle>
              <Button variant="ghost" size="sm" className="text-[11px] font-bold text-[var(--color-primary)]">
                Full Audit Log
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-full">Event</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentActivity.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <activity.icon className="size-4 text-[var(--color-outline)]" />
                          <div>
                            <p className="text-[11px] font-bold">
                              {activity.title}
                            </p>
                            <p className="text-[10px] text-[var(--color-outline)]">
                              {activity.user} • {activity.time}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <StatusBadge
                          variant={
                            activity.status === "success" ? "success" : "error"
                          }
                          size="sm"
                        >
                          {activity.status === "success" ? "Success" : "Failed"}
                        </StatusBadge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-5">
          <Card className={cn(CONSOLE_SURFACE_CARD, "bg-[var(--color-primary)]/5 border-[var(--color-primary)]/10")}>
            <CardHeader className={CONSOLE_SURFACE_HEADER_COMPACT}>
              <CardTitle className="text-xs font-extrabold uppercase tracking-widest text-[var(--color-primary)] flex items-center gap-2">
                <CheckCircle className="size-4" />
                Operational Shortcuts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-4">
              <div className="space-y-2">
                {shortcuts.map((shortcut) => (
                  <Button
                    key={shortcut.id}
                    variant="outline"
                    className="w-full flex items-center justify-between p-2.5 rounded-lg bg-white border-[var(--color-outline-variant)]/30 hover:border-[var(--color-primary)]/40 hover:shadow-sm transition-all"
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
              </div>
            </CardContent>
          </Card>

          <Card className={CONSOLE_SURFACE_CARD}>
            <CardHeader className={CONSOLE_SURFACE_HEADER_COMPACT}>
              <CardTitle className="text-xs font-bold">Admin Resources</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="space-y-1.5">
                <Button variant="link" className="text-[11px] text-[var(--color-primary)] p-0 h-auto justify-start">
                  Naming Policy Guidelines
                </Button>
                <Button variant="link" className="text-[11px] text-[var(--color-primary)] p-0 h-auto justify-start">
                  Privileged Access Manual
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
