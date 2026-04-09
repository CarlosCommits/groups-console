import { useState } from "react";
import {
  Plus,
  History,
  Edit,
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
import { Badge } from "@/renderer/components/ui/badge";
import { Avatar, AvatarFallback } from "@/renderer/components/ui/avatar";
import { Progress } from "@/renderer/components/ui/progress";
import {
  AppShell,
  TableToolbar,
  FilterSegmentedControl,
  TableFilterButton,
} from "@/renderer/components/console";
import {
  CONSOLE_SURFACE_CARD,
  CONSOLE_SURFACE_HEADER_COMPACT,
} from "@/renderer/components/console/surface-styles";
import { cn } from "@/renderer/lib/utils";

interface DirectoryItem {
  id: string;
  initials: string;
  name: string;
  email: string;
  emailSuffix?: string;
  organization: string;
  type: "user" | "group" | "guest";
  source: string;
  membership: string;
  avatarColor: string;
}

const directoryItems: DirectoryItem[] = [
  { id: "1", initials: "JD", name: "Julianne Deidre", email: "j.deidre@enterprise.com", emailSuffix: "#9920-X", organization: "Stark Industries", type: "user", source: "Azure AD", membership: "Premium Support", avatarColor: "bg-teal-100 text-[var(--color-primary)]" },
  { id: "2", initials: "MP", name: "Marketing Partners", email: "marketing-dl@global.com", organization: "Distribution List", type: "group", source: "Console Local", membership: "Standard Tier", avatarColor: "bg-slate-100 text-slate-500" },
  { id: "3", initials: "EK", name: "Erik Klausen", email: "erik@freelance.de", organization: "Independent", type: "guest", source: "Manual Entry", membership: "Ad-hoc Access", avatarColor: "bg-[var(--color-tertiary-fixed)] text-[var(--color-tertiary)]" },
  { id: "4", initials: "SA", name: "Sarah Al-Fayed", email: "s.fayed@horizon.io", emailSuffix: "#4110-B", organization: "Horizon Systems", type: "user", source: "Azure AD", membership: "Enterprise Plus", avatarColor: "bg-teal-100 text-[var(--color-primary)]" },
  { id: "5", initials: "MR", name: "Marcus Reed", email: "m.reed@stark.com", organization: "Stark Industries", type: "user", source: "Azure AD", membership: "Standard Tier", avatarColor: "bg-teal-100 text-[var(--color-primary)]" },
  { id: "6", initials: "OP", name: "Ops Personnel", email: "ops-team@global.com", organization: "Distribution List", type: "group", source: "Console Local", membership: "Internal Only", avatarColor: "bg-slate-100 text-slate-500" },
  { id: "7", initials: "LL", name: "Lana Lang", email: "lana@dailyplanet.com", organization: "Independent", type: "guest", source: "Manual Entry", membership: "Limited Access", avatarColor: "bg-[var(--color-tertiary-fixed)] text-[var(--color-tertiary)]" },
  { id: "8", initials: "CK", name: "Clark Kent", email: "c.kent@enterprise.com", organization: "Stark Industries", type: "user", source: "Azure AD", membership: "Premium Support", avatarColor: "bg-teal-100 text-[var(--color-primary)]" },
  { id: "9", initials: "BW", name: "Bruce Wayne", email: "b.wayne@horizon.io", organization: "Horizon Systems", type: "user", source: "Azure AD", membership: "Enterprise Plus", avatarColor: "bg-teal-100 text-[var(--color-primary)]" },
  { id: "10", initials: "DS", name: "Design Studio", email: "design@creatives.com", organization: "Distribution List", type: "group", source: "Console Local", membership: "Standard Tier", avatarColor: "bg-slate-100 text-slate-500" },
  { id: "11", initials: "DP", name: "Diana Prince", email: "diana@justice.org", organization: "Independent", type: "guest", source: "Manual Entry", membership: "Ad-hoc Access", avatarColor: "bg-[var(--color-tertiary-fixed)] text-[var(--color-tertiary)]" },
];

const activityItems = [
  { id: 1, type: "success", title: "Bulk Identity Sync", description: "42 new users provisioned via Azure AD Connector.", time: "4m ago" },
  { id: 2, type: "warning", title: "Perm Escalation", description: "Erik Klausen granted 'Write' access to project 'Delta_9'.", time: "1h ago" },
];

export function DirectoryScreen() {
  const [activeTab, setActiveTab] = useState("all");

  const tabs = [
    { label: "All", value: "all" },
    { label: "Contacts", value: "contacts" },
    { label: "Guests", value: "guests" },
    { label: "Groups", value: "groups" },
  ];

  return (
    <AppShell>
      <div className="h-[calc(100vh-7rem)] flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Workspace / Directory
              </p>
              <h1 className="text-2xl font-extrabold font-headline tracking-tight text-[var(--color-foreground)]">
                Directory Workspace
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Manage users, cross-functional groups, and external guests in a high-density operational view.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs font-semibold">
                Export Registry
              </Button>
              <Button size="sm" className="text-xs font-semibold">
                <Plus className="size-3 mr-1" />
                Create Identity
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[var(--color-outline-variant)]/20 overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
            <TableToolbar
              searchPlaceholder="Search by name, email, or handle..."
              filters={
                <>
                  <FilterSegmentedControl
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                  />
                  <TableFilterButton label="Filters" />
                </>
              }
            />

            <div className="overflow-x-auto flex-1 custom-scrollbar min-h-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 border-b border-[var(--color-outline-variant)]/10">
                    <TableHead className="w-[22%] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Identity Name
                    </TableHead>
                    <TableHead className="w-[23%] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Email / ID
                    </TableHead>
                    <TableHead className="w-[17%] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Organization
                    </TableHead>
                    <TableHead className="w-[12%] text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Type
                    </TableHead>
                    <TableHead className="w-[12%] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Source
                    </TableHead>
                    <TableHead className="w-[14%] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Membership
                    </TableHead>
                    <TableHead className="text-right w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {directoryItems.map((item) => (
                    <TableRow
                      key={item.id}
                      className="hover:bg-teal-50/30 transition-colors group"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6 text-[10px]">
                            <AvatarFallback className={item.avatarColor}>
                              {item.initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-semibold text-[var(--color-foreground)]">
                            {item.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700 font-medium">
                        {item.email}
                        {item.emailSuffix && (
                          <span className="ml-1 text-[10px] text-slate-400">
                            {item.emailSuffix}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {item.organization}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.type === "user" && (
                          <Badge className="border border-teal-200 bg-teal-50 text-[11px] font-semibold text-[var(--color-primary)]">
                            ACTIVE USER
                          </Badge>
                        )}
                        {item.type === "group" && (
                          <Badge className="border-transparent bg-[var(--color-primary)] text-white text-[11px] font-semibold">
                            GROUP
                          </Badge>
                        )}
                        {item.type === "guest" && (
                          <Badge className="border border-orange-200 bg-orange-50 text-[11px] font-semibold text-[var(--color-tertiary)]">
                            GUEST
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {item.source}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {item.membership}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 opacity-0 group-hover:opacity-100 transition-all p-1"
                        >
                          <Edit className="size-3 text-slate-300" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-3 grid grid-cols-12 gap-3">
              <div className="col-span-12 lg:col-span-8">
                <Card className={CONSOLE_SURFACE_CARD}>
                  <CardHeader
                    className={cn(
                      CONSOLE_SURFACE_HEADER_COMPACT,
                      "flex flex-row items-center justify-between space-y-0 px-3 pt-3"
                    )}
                  >
                    <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <History className="size-3 text-[var(--color-primary)]" />
                      Recent Activity
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="text-[9px] font-bold text-[var(--color-primary)] h-auto p-0">
                      View All Logs
                    </Button>
                  </CardHeader>
                  <CardContent className="p-3 pt-2">
                    <div className="space-y-1.5">
                      {activityItems.map((activity) => (
                        <div key={activity.id} className="flex items-center gap-3 text-[11px]">
                          <div
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              activity.type === "success" ? "bg-teal-500" : "bg-amber-500"
                            )}
                          />
                          <span className="w-32 shrink-0 text-[11px] font-semibold text-slate-700">
                            {activity.title}
                          </span>
                          <span className="truncate text-[11px] text-slate-500">
                            {activity.description}
                          </span>
                          <span className="ml-auto whitespace-nowrap text-[10px] text-slate-400">
                            {activity.time}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="col-span-12 lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-2">
                <Card
                  className={cn(
                    CONSOLE_SURFACE_CARD,
                    "bg-[var(--color-primary)] border-none text-white shadow-md"
                  )}
                >
                  <CardContent className="flex items-center justify-between p-2.5">
                    <div>
                      <p className="text-[8px] font-bold opacity-70 uppercase tracking-widest">
                        Total Identities
                      </p>
                      <h4 className="text-lg font-extrabold font-headline leading-tight">
                        14,240
                      </h4>
                    </div>
                    <div className="text-[9px] font-bold bg-white/20 px-1.5 py-0.5 rounded">
                      +12%
                    </div>
                  </CardContent>
                </Card>
                <Card className={CONSOLE_SURFACE_CARD}>
                  <CardContent className="p-2.5 flex flex-col justify-center">
                    <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      <span>Sync Health</span>
                      <span className="text-teal-600">99.9%</span>
                    </div>
                    <Progress value={99.9} className="w-full h-1" />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
