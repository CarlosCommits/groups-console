import { useState } from "react";
import {
  Search,
  Filter,
  UserPlus,
  Settings,
  Wrench,
  ChevronRight,
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
import { Input } from "@/renderer/components/ui/input";
import { Badge } from "@/renderer/components/ui/badge";
import { Avatar, AvatarFallback } from "@/renderer/components/ui/avatar";
import { AppShell } from "@/renderer/components/console";
import { cn } from "@/renderer/lib/utils";

interface GroupItem {
  id: string;
  name: string;
  members: number;
  type: "Security" | "M365 Group" | "Distribution";
}

interface MemberItem {
  id: string;
  initials: string;
  name: string;
  email: string;
  title: string;
  role: "Owner" | "Member";
  avatarColor: string;
}

const groups: GroupItem[] = [
  { id: "1", name: "Product Engineering", members: 142, type: "Security" },
  { id: "2", name: "Marketing Ops", members: 38, type: "M365 Group" },
  { id: "3", name: "Global Distribution", members: 1204, type: "Distribution" },
  { id: "4", name: "Executive Staff", members: 12, type: "Security" },
  { id: "5", name: "DevOps Read-Only", members: 45, type: "Security" },
  { id: "6", name: "Human Resources", members: 9, type: "Distribution" },
  { id: "7", name: "Legal Compliance", members: 22, type: "Security" },
  { id: "8", name: "Finance Approvers", members: 15, type: "M365 Group" },
  { id: "9", name: "Regional Sales - North", members: 214, type: "Distribution" },
  { id: "10", name: "Project Omega", members: 5, type: "Security" },
];

const members: MemberItem[] = [
  { id: "1", initials: "AS", name: "Alex Sterling", email: "alex.s@company.com", title: "Senior DevSecOps", role: "Member", avatarColor: "bg-teal-100 text-teal-700" },
  { id: "2", initials: "MJ", name: "Marcus Jensen", email: "m.jensen@company.com", title: "Lead Architect", role: "Owner", avatarColor: "bg-indigo-100 text-indigo-700" },
  { id: "3", initials: "SL", name: "Sarah Lo", email: "sarah.lo@company.com", title: "Product Designer", role: "Member", avatarColor: "bg-orange-100 text-orange-700" },
  { id: "4", initials: "DW", name: "David Wu", email: "dwu@company.com", title: "QA Engineer", role: "Member", avatarColor: "bg-slate-200 text-slate-700" },
  { id: "5", initials: "KP", name: "Kelly Parker", email: "kp@company.com", title: "Cloud Engineer", role: "Member", avatarColor: "bg-emerald-100 text-emerald-700" },
  { id: "6", initials: "RN", name: "Robert Ng", email: "rng@company.com", title: "Security Analyst", role: "Member", avatarColor: "bg-blue-100 text-blue-700" },
  { id: "7", initials: "LC", name: "Lisa Chen", email: "lchen@company.com", title: "Software Engineer", role: "Member", avatarColor: "bg-purple-100 text-purple-700" },
];

export function GroupsScreen() {
  const [selectedGroup, setSelectedGroup] = useState<GroupItem>(groups[0]);
  const [activeTab, setActiveTab] = useState("members");

  return (
    <AppShell>
      <div className="h-[calc(100vh-7rem)] flex flex-col overflow-hidden">
        <div className="flex flex-1 overflow-hidden rounded-xl border border-[var(--color-outline-variant)]/20 bg-white shadow-sm">
          <section className="w-80 flex flex-col bg-slate-50 border-r border-slate-200/50 flex-none h-full">
            <div className="p-4 bg-white border-b border-slate-200/50 flex-none">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-headline text-sm font-bold text-[var(--color-foreground)]">
                  Groups <span className="text-slate-400 font-normal ml-1">(24)</span>
                </h2>
              </div>
              <div className="relative">
                <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 size-4 z-10" />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 size-3" />
                <Input
                  className="w-full bg-slate-100 border-none rounded-md py-1.5 pl-8 pr-3 text-xs"
                  placeholder="Filter groups..."
                  type="text"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-full">Display Name</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => (
                    <TableRow
                      key={group.id}
                      className={cn(
                        "group cursor-pointer border-l-2 transition-colors",
                        selectedGroup.id === group.id
                          ? "bg-[var(--color-primary)]/5 border-[var(--color-primary)]"
                          : "hover:bg-white border-transparent"
                      )}
                      onClick={() => setSelectedGroup(group)}
                    >
                      <TableCell>
                        <p
                          className={cn(
                            "text-xs truncate",
                            selectedGroup.id === group.id
                              ? "font-bold text-[var(--color-primary)]"
                              : "font-semibold text-slate-700"
                          )}
                        >
                          {group.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {group.members} members
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1.5 py-0.5"
                        >
                          {group.type}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="flex-1 bg-[var(--color-surface)] flex flex-col overflow-hidden h-full min-w-0">
            <div className="p-6 bg-white border-b border-slate-200/50 flex-none">
              <div className="flex justify-between items-start">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-[var(--color-primary)]/10 rounded-lg flex items-center justify-center text-[var(--color-primary)] shrink-0">
                    <Wrench className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg font-extrabold font-headline tracking-tight">
                        {selectedGroup.name}
                      </h1>
                      <Badge variant="secondary" className="text-[9px] font-bold uppercase">
                        {selectedGroup.type} Group
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 max-w-lg mt-0.5">
                      Internal security group for platform development access control and cloud resource provisioning.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="text-xs">
                    <UserPlus className="size-4 mr-1" />
                    Add Member
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs">
                    <Settings className="size-4 mr-1" />
                    Settings
                  </Button>
                </div>
              </div>
              <div className="flex gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    Total Members:
                  </span>
                  <span className="text-xs font-extrabold font-headline">
                    {selectedGroup.members}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    ID:
                  </span>
                  <span className="text-xs font-mono text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded">
                    PE-9902-SEC
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 pt-3 flex items-center justify-between border-b border-slate-200/50 flex-none bg-white">
              <div className="flex gap-6">
                {["Members", "Owners", "Settings", "Audit Logs"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab.toLowerCase())}
                    className={cn(
                      "text-xs font-semibold pb-3 transition-colors border-b-2",
                      activeTab === tab.toLowerCase()
                        ? "text-[var(--color-primary)] border-[var(--color-primary)]"
                        : "text-slate-400 border-transparent hover:text-slate-600"
                    )}
                  >
                    {tab === "Members"
                      ? `Members (${selectedGroup.members})`
                      : tab}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 pb-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
                  <Input
                    className="bg-slate-100 border-none text-[11px] rounded-full pl-7 pr-3 py-1 w-48"
                    placeholder="Filter current list..."
                    type="text"
                  />
                </div>
                <select className="bg-white border-slate-200 border text-[11px] rounded px-2 py-1 outline-none">
                  <option>Sort: Name</option>
                  <option>Sort: Role</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-hidden p-0 flex flex-col">
              <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
                <div className="bg-white border border-slate-200/60 rounded-lg overflow-hidden min-h-full">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 sticky top-0 z-10">
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Job Title</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => (
                        <TableRow
                          key={member.id}
                          className="hover:bg-slate-50/50 transition-colors group"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar className="w-6 h-6 text-[9px]">
                                <AvatarFallback className={member.avatarColor}>
                                  {member.initials}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs font-bold text-slate-800">
                                {member.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 font-medium">
                            {member.email}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {member.title}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={member.role === "Owner" ? "default" : "secondary"}
                              className="text-[9px] uppercase"
                            >
                              {member.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-[var(--color-error)]"
                            >
                              <ChevronRight className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
