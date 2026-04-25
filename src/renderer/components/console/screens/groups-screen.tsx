import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Filter,
  UserPlus,
  UserMinus,
  RefreshCw,
  Wrench,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  WifiOff,
  Info,
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
import { Input } from "@/renderer/components/ui/input";
import { Badge } from "@/renderer/components/ui/badge";
import { Avatar, AvatarFallback } from "@/renderer/components/ui/avatar";
import { Checkbox } from "@/renderer/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/renderer/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/renderer/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/renderer/components/ui/select";
import { AppShell } from "@/renderer/components/console";
import {
  formatPresentedCommandFailure,
  presentCommandFailure,
} from "@/renderer/components/console/command-failure-presenter";
import {
  formatSourceDegradationNote,
  presentSourceDegradation,
} from "@/renderer/components/console/source-degradation-presenter";
import {
  canDismissMutationDialog,
  handleMutationDialogOpenChange,
} from "@/renderer/components/console/mutation-dialog-guard";
import {
  CONSOLE_SURFACE_CARD,
  CONSOLE_SURFACE_HEADER_COMPACT,
} from "@/renderer/components/console/surface-styles";
import { toGroupMemberSelectionRef } from "@/renderer/lib/group-member-selection";
import { cn } from "@/renderer/lib/utils";
import { useApp } from "@/renderer/components/console/app-context";
import {
  useExchangeGroupsQuery,
} from "@/renderer/hooks/use-exchange-groups";
import {
  useGroupMembersQuery,
} from "@/renderer/hooks/use-group-members";
import {
  useAddGroupMembersMutation,
  useRemoveGroupMembersMutation,
} from "@/renderer/hooks/use-group-member-mutations";
import type {
  ExchangeGroupListItem,
  ExchangeGroupRef,
  GroupMemberListItem,
  GroupMemberSelectionRef,
  GroupMemberWriteRef,
  GroupsAddMembersResult,
  GroupsRemoveMembersResult,
} from "@/shared/contracts/exchange";
import type {
  RecipientSearchItem,
  RecipientSearchType,
  RecipientsSearchResult,
} from "@/shared/contracts/recipients";

const GROUP_KIND_LABELS: Record<ExchangeGroupListItem["groupKind"], string> = {
  distributionList: "Distribution",
  mailEnabledSecurityGroup: "Security",
};

const RECIPIENT_TYPE_LABELS: Record<GroupMemberListItem["recipientType"], string> = {
  mailbox: "Mailbox",
  mailContact: "Mail Contact",
  mailUser: "Mail User",
  guestMailUser: "Guest Mail User",
  distributionList: "Distribution",
  mailEnabledSecurityGroup: "Security",
  unknown: "Unknown",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-teal-100 text-teal-700",
  "bg-indigo-100 text-indigo-700",
  "bg-orange-100 text-orange-700",
  "bg-emerald-100 text-emerald-700",
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-cyan-100 text-cyan-700",
  "bg-pink-100 text-pink-700",
];

function avatarColorFor(identity: string): string {
  let hash = 0;
  for (let i = 0; i < identity.length; i++) {
    hash = (hash * 31 + identity.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function groupRefFromListItem(group: ExchangeGroupListItem): ExchangeGroupRef {
  return {
    exchangeIdentity: group.exchangeIdentity,
    objectId: group.objectId,
    groupKind: group.groupKind,
  };
}

const RECIPIENT_SEARCH_TYPE_LABELS: Record<RecipientSearchType, string> = {
  mailbox: "Mailbox",
  mailContact: "Mail Contact",
  mailUser: "Mail User",
  guestMailUser: "Guest Mail User",
  distributionList: "Distribution",
  mailEnabledSecurityGroup: "Security",
  guestUser: "Guest",
  unknown: "Unknown",
};

const ADD_STATUS_LABELS: Record<GroupsAddMembersResult["items"][number]["status"], string> = {
  added: "Added",
  alreadyMember: "Already a member",
  invalid: "Invalid",
  verificationFailed: "Verification failed",
  failed: "Failed",
};

const REMOVE_STATUS_LABELS: Record<GroupsRemoveMembersResult["items"][number]["status"], string> = {
  removed: "Removed",
  notMember: "Not a member",
  invalid: "Invalid",
  verificationFailed: "Verification failed",
  failed: "Failed",
};

function isCandidateSelectable(candidate: RecipientSearchItem): boolean {
  if (candidate.membershipSupport === "exchangeDirect" && candidate.exchangeIdentity !== null) {
    return true;
  }
  if (candidate.membershipSupport === "graphBridgeable" && candidate.objectId !== null) {
    return true;
  }
  return false;
}

function candidateDisableReason(candidate: RecipientSearchItem): string | null {
  if (candidate.membershipSupport === "graphDeferred") {
    return "Requires Graph connection to add";
  }
  if (candidate.membershipSupport === "unsupported") {
    return "Not eligible for group membership";
  }
  if (candidate.membershipSupport === "exchangeDirect" && candidate.exchangeIdentity === null) {
    return "No Exchange identity";
  }
  if (candidate.membershipSupport === "graphBridgeable" && candidate.objectId === null) {
    return "No Graph object identity";
  }
  return null;
}

function isAddStatusClean(status: GroupsAddMembersResult["items"][number]["status"]): boolean {
  return status === "added" || status === "alreadyMember";
}

function isRemoveStatusClean(status: GroupsRemoveMembersResult["items"][number]["status"]): boolean {
  return status === "removed" || status === "notMember";
}

const CANDIDATE_SEARCH_TYPES: RecipientSearchType[] = [
  "mailbox",
  "mailContact",
  "mailUser",
  "guestMailUser",
  "distributionList",
  "mailEnabledSecurityGroup",
  "guestUser",
];

export function GroupsScreen() {
  const { shell } = useApp();
  const exchangeConnection = shell.exchangeConnection;
  const exchangeConnected = exchangeConnection?.state === "connected";
  const {
    groups,
    appliedKind,
    isLoading: groupsLoading,
    error: groupsError,
    refetch: refetchGroups,
  } = useExchangeGroupsQuery(exchangeConnection);

  const [selectedGroup, setSelectedGroup] = useState<ExchangeGroupListItem | null>(null);

  const [activeTab, setActiveTab] = useState("members");
  const [sortBy, setSortBy] = useState("name");
  const [groupFilter, setGroupFilter] = useState("");
  const [memberFilter, setMemberFilter] = useState("");

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState("");
  const [addCandidates, setAddCandidates] = useState<RecipientSearchItem[]>([]);
  const [addSelectedKeys, setAddSelectedKeys] = useState<Set<string>>(new Set());
  const [addSearchLoading, setAddSearchLoading] = useState(false);
  const [addSearchError, setAddSearchError] = useState<string | null>(null);
  const [addSearchResult, setAddSearchResult] = useState<RecipientsSearchResult | null>(null);
  const [addPending, setAddPending] = useState(false);
  const [addResult, setAddResult] = useState<GroupsAddMembersResult | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const [removeConfirmTarget, setRemoveConfirmTarget] = useState<GroupMemberListItem | null>(null);
  const [removePending, setRemovePending] = useState(false);
  const [removeResult, setRemoveResult] = useState<GroupsRemoveMembersResult | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const hasGroupsData = appliedKind !== null;
  const showStaleGroupsError = groupsError !== null && hasGroupsData;
  const {
    members,
    isLoading: membersLoading,
    isFetching: membersFetching,
    error: membersError,
    hasData: hasMembersData,
    refetch: refetchMembers,
  } = useGroupMembersQuery(exchangeConnection, selectedGroup);
  const showBlockingMembersError = membersError !== null && !hasMembersData;
  const showStaleMembersError = membersError !== null && hasMembersData;
  const addGroupMembersMutation = useAddGroupMembersMutation(exchangeConnection);
  const removeGroupMembersMutation = useRemoveGroupMembersMutation(exchangeConnection);

  useEffect(() => {
    if (groups.length === 0) {
      setSelectedGroup(null);
      return;
    }
    setSelectedGroup((prev) => {
      if (prev) {
        const stillPresent = groups.find(
          (g) => g.exchangeIdentity === prev.exchangeIdentity,
        );
        if (stillPresent) return stillPresent;
      }
      return groups[0];
    });
  }, [groups]);

  const filteredGroups = useMemo(() => {
    if (!groupFilter.trim()) return groups;
    const lower = groupFilter.toLowerCase();
    return groups.filter(
      (g) =>
        g.displayName.toLowerCase().includes(lower) ||
        (g.primaryEmail ?? "").toLowerCase().includes(lower) ||
        (g.alias ?? "").toLowerCase().includes(lower),
      );
  }, [groups, groupFilter]);

  useEffect(() => {
    if (filteredGroups.length === 0) {
      setSelectedGroup(null);
      return;
    }

    setSelectedGroup((prev) => {
      if (prev) {
        const stillVisible = filteredGroups.find(
          (group) => group.exchangeIdentity === prev.exchangeIdentity,
        );

        if (stillVisible) {
          return stillVisible;
        }
      }

      return filteredGroups[0];
    });
  }, [filteredGroups]);

  const visibleMembers = useMemo(() => {
    let list = [...members];

    if (memberFilter.trim()) {
      const lower = memberFilter.toLowerCase();
      list = list.filter(
        (m) =>
          m.displayName.toLowerCase().includes(lower) ||
          (m.primaryEmail ?? "").toLowerCase().includes(lower),
      );
    }

    list.sort((a, b) => {
      if (sortBy === "role") {
        return a.recipientType.localeCompare(b.recipientType) || a.displayName.localeCompare(b.displayName);
      }
      return a.displayName.localeCompare(b.displayName);
    });

    return list;
  }, [members, memberFilter, sortBy]);

  useEffect(() => {
    if (!addDialogOpen) return;
    if (addSearchQuery.trim().length < 2) {
      setAddCandidates([]);
      setAddSearchResult(null);
      setAddSearchLoading(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setAddSearchLoading(true);
      setAddSearchError(null);
      window.radApp.recipients
        .search({ query: addSearchQuery.trim(), types: CANDIDATE_SEARCH_TYPES })
        .then((result) => {
          if (!cancelled) {
            setAddCandidates(result.items);
            setAddSearchResult(result);
            setAddSearchLoading(false);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setAddSearchError(
              formatPresentedCommandFailure(
                presentCommandFailure(err, "Search Error", "Search failed."),
              ),
            );
            setAddSearchResult(null);
            setAddSearchLoading(false);
          }
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [addDialogOpen, addSearchQuery]);

  useEffect(() => {
    setAddSelectedKeys((currentKeys) => {
      if (currentKeys.size === 0) {
        return currentKeys;
      }

      const visibleKeys = new Set(addCandidates.map((candidate) => candidate.stableKey));
      const nextKeys = new Set(
        [...currentKeys].filter((key) => visibleKeys.has(key)),
      );

      return nextKeys.size === currentKeys.size ? currentKeys : nextKeys;
    });
  }, [addCandidates]);

  const openAddDialog = useCallback(() => {
    setAddSearchQuery("");
    setAddCandidates([]);
    setAddSelectedKeys(new Set());
    setAddSearchLoading(false);
    setAddSearchError(null);
    setAddSearchResult(null);
    setAddPending(false);
    setAddResult(null);
    setAddError(null);
    setAddDialogOpen(true);
  }, []);

  const addDegradationNote = addSearchResult
    ? presentSourceDegradation(addSearchResult.sourceStatus, addSearchResult.sourceFailures)
    : null;

  const handleAddMembers = useCallback(async () => {
    if (!selectedGroup) return;
    const selectable = addCandidates.filter(
      (c) => isCandidateSelectable(c) && addSelectedKeys.has(c.stableKey),
    );
    if (selectable.length === 0) return;
    const memberRefs: GroupMemberSelectionRef[] = selectable
      .map((candidate) => toGroupMemberSelectionRef(candidate))
      .filter((candidate): candidate is GroupMemberSelectionRef => candidate !== null);
    const groupRef = groupRefFromListItem(selectedGroup);
    setAddPending(true);
    setAddError(null);
    setAddResult(null);
    try {
      const result = await addGroupMembersMutation.mutateAsync({
        groupRef,
        memberRefs,
      });
      setAddResult(result);
    } catch (err) {
      setAddError(
        formatPresentedCommandFailure(
          presentCommandFailure(err, "Add Members Error", "Failed to add members."),
        ),
      );
    } finally {
      setAddPending(false);
    }
  }, [selectedGroup, addCandidates, addSelectedKeys, addGroupMembersMutation]);

  const handleRemoveMember = useCallback(async () => {
    if (!selectedGroup || !removeConfirmTarget) return;
    const memberRef: GroupMemberWriteRef = {
      exchangeIdentity: removeConfirmTarget.exchangeIdentity,
      objectId: removeConfirmTarget.objectId,
      primaryEmail: removeConfirmTarget.primaryEmail,
    };
    const groupRef = groupRefFromListItem(selectedGroup);
    setRemovePending(true);
    setRemoveError(null);
    setRemoveResult(null);
    try {
      const result = await removeGroupMembersMutation.mutateAsync({
        groupRef,
        memberRefs: [memberRef],
      });
      setRemoveResult(result);
      const allClean = result.items.every((item) => isRemoveStatusClean(item.status));
      if (allClean) {
        setRemoveConfirmTarget(null);
        setRemoveResult(null);
      }
    } catch (err) {
      setRemoveError(
        formatPresentedCommandFailure(
          presentCommandFailure(err, "Remove Member Error", "Failed to remove member."),
        ),
      );
    } finally {
      setRemovePending(false);
    }
  }, [selectedGroup, removeConfirmTarget, removeGroupMembersMutation]);

  if (!exchangeConnected) {
    return (
      <AppShell>
        <div className="h-[calc(100vh-7rem)] pt-6 flex flex-col overflow-hidden">
          <div className="flex flex-1 items-center justify-center rounded-xl border border-[var(--color-outline-variant)]/20 bg-white shadow-sm">
            <div className="text-center py-16 px-8">
              <WifiOff className="size-10 text-slate-300 mx-auto mb-4" />
              <h2 className="text-lg font-bold font-headline text-slate-700 mb-2">
                Exchange Not Connected
              </h2>
              <p className="text-sm text-slate-500 max-w-sm">
                Connect to Exchange Online to view and manage groups. Use the sidebar or header to establish a connection.
              </p>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (groupsLoading) {
    return (
      <AppShell>
        <div className="h-[calc(100vh-7rem)] pt-6 flex flex-col overflow-hidden">
          <div className="flex flex-1 items-center justify-center rounded-xl border border-[var(--color-outline-variant)]/20 bg-white shadow-sm">
            <div className="text-center py-16 px-8">
              <Loader2 className="size-8 text-[var(--color-primary)] mx-auto mb-4 animate-spin" />
              <p className="text-sm text-slate-500">Loading groups…</p>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (groupsError && appliedKind === null) {
    return (
      <AppShell>
        <div className="h-[calc(100vh-7rem)] pt-6 flex flex-col overflow-hidden">
          <div className="flex flex-1 items-center justify-center rounded-xl border border-[var(--color-outline-variant)]/20 bg-white shadow-sm">
            <div className="text-center py-16 px-8">
              <AlertCircle className="size-10 text-[var(--color-error)] mx-auto mb-4" />
              <h2 className="text-lg font-bold font-headline text-slate-700 mb-2">
                Failed to Load Groups
              </h2>
              <p className="text-sm text-slate-500 max-w-sm mb-4">{groupsError}</p>
              <Button size="sm" onClick={() => void refetchGroups()}>
                Retry
              </Button>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (groups.length === 0) {
    return (
      <AppShell>
        <div className="h-[calc(100vh-7rem)] pt-6 flex flex-col overflow-hidden">
          <div className="flex flex-1 items-center justify-center rounded-xl border border-[var(--color-outline-variant)]/20 bg-white shadow-sm">
            <div className="text-center py-16 px-8">
              {showStaleGroupsError ? (
                <AlertCircle className="size-10 text-[var(--color-error)] mx-auto mb-4" />
              ) : (
                <Filter className="size-10 text-slate-300 mx-auto mb-4" />
              )}
              <h2 className="text-lg font-bold font-headline text-slate-700 mb-2">
                {showStaleGroupsError ? "Group Inventory May Be Stale" : "No Groups Found"}
              </h2>
              <p className="text-sm text-slate-500 max-w-sm">
                {showStaleGroupsError
                  ? groupsError
                  : "No Exchange groups are available for the current connection."}
              </p>
              {showStaleGroupsError && (
                <Button size="sm" className="mt-4" onClick={() => void refetchGroups()}>
                  Retry
                </Button>
              )}
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="h-[calc(100vh-7rem)] pt-6 flex flex-col overflow-hidden">
        <div className="flex flex-1 overflow-hidden rounded-xl border border-[var(--color-outline-variant)]/20 bg-white shadow-sm">
          <section className="w-80 flex flex-col bg-slate-50 border-r border-slate-200/50 flex-none h-full">
            <div className="p-4 bg-white border-b border-slate-200/50 flex-none">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-headline text-sm font-bold text-[var(--color-foreground)]">
                  Groups <span className="text-slate-400 font-normal ml-1">({groups.length})</span>
                </h2>
              </div>
              {showStaleGroupsError && (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-amber-200/70 bg-amber-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-amber-900">Inventory may be stale</p>
                    <p className="text-[10px] text-amber-800/80 truncate">{groupsError}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-[10px]"
                    onClick={() => void refetchGroups()}
                  >
                    Retry
                  </Button>
                </div>
              )}
              <div className="relative">
                <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 size-4 z-10" />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 size-3" />
                <Input
                  className="w-full bg-slate-100 border-none rounded-md py-1.5 pl-8 pr-3 text-xs"
                  placeholder="Filter groups..."
                  type="text"
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
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
                  {filteredGroups.map((group) => (
                    <TableRow
                      key={group.exchangeIdentity}
                      className={cn(
                        "group cursor-pointer border-l-2 transition-colors",
                        selectedGroup?.exchangeIdentity === group.exchangeIdentity
                          ? "bg-[var(--color-primary)]/5 border-[var(--color-primary)]"
                          : "hover:bg-white border-transparent"
                      )}
                      onClick={() => setSelectedGroup(group)}
                    >
                      <TableCell>
                        <p
                          className={cn(
                            "text-xs truncate",
                            selectedGroup?.exchangeIdentity === group.exchangeIdentity
                              ? "font-bold text-[var(--color-primary)]"
                              : "font-semibold text-slate-700"
                          )}
                        >
                          {group.displayName}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {group.primaryEmail ?? "—"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1.5 py-0.5"
                        >
                          {GROUP_KIND_LABELS[group.groupKind]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="flex-1 bg-[var(--color-surface)] flex flex-col overflow-hidden h-full min-w-0">
            {selectedGroup ? (
              <>
                <div className="p-6 bg-white border-b border-slate-200/50 flex-none">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 bg-[var(--color-primary)]/10 rounded-lg flex items-center justify-center text-[var(--color-primary)] shrink-0">
                        <Wrench className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-extrabold font-headline tracking-tight">
                            {selectedGroup.displayName}
                          </h2>
                          <Badge variant="secondary" className="text-[9px] font-bold uppercase">
                            {GROUP_KIND_LABELS[selectedGroup.groupKind]} Group
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 max-w-lg mt-0.5">
                          {selectedGroup.primaryEmail ?? selectedGroup.alias ?? "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="text-xs" onClick={openAddDialog} disabled={!selectedGroup}>
                        <UserPlus className="size-4 mr-1" />
                        Add Member
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="text-xs"
                        disabled={!selectedGroup || membersFetching}
                        onClick={() => void refetchMembers()}
                        aria-label="Refresh members"
                        title="Refresh members"
                      >
                        <RefreshCw className={cn("size-4", membersFetching && "animate-spin")} />
                      </Button>
                    </div>
                  </div>
                    <div className="flex gap-6 mt-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          Total Members:
                        </span>
                        <span className="text-xs font-extrabold font-headline">
                          {membersLoading ? "…" : members.length}
                        </span>
                      </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        ID:
                      </span>
                      <span className="text-xs font-mono text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded">
                        {selectedGroup.objectId ?? selectedGroup.exchangeIdentity}
                      </span>
                    </div>
                    {selectedGroup.whenChangedUtc && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          Modified:
                        </span>
                        <span className="text-xs text-slate-600">
                          {new Date(selectedGroup.whenChangedUtc).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="flex flex-1 flex-col gap-0 overflow-hidden"
                >
                  <div className="px-6 pt-3 flex items-center justify-between border-b border-slate-200/50 flex-none bg-white">
                    <TabsList variant="line" className="h-auto bg-transparent gap-6 p-0">
                      <TabsTrigger
                        value="members"
                        className="text-xs font-semibold pb-3 data-[state=active]:text-[var(--color-primary)] text-slate-400 hover:text-slate-600"
                      >
                        Members{!membersLoading ? ` (${members.length})` : ""}
                      </TabsTrigger>
                      <TabsTrigger
                        value="owners"
                        className="text-xs font-semibold pb-3 data-[state=active]:text-[var(--color-primary)] text-slate-400 hover:text-slate-600"
                      >
                        Owners
                      </TabsTrigger>
                      <TabsTrigger
                        value="settings"
                        className="text-xs font-semibold pb-3 data-[state=active]:text-[var(--color-primary)] text-slate-400 hover:text-slate-600"
                      >
                        Settings
                      </TabsTrigger>
                    </TabsList>
                    {activeTab === "members" ? (
                      <div className="flex items-center gap-2 pb-2">
                        <Input
                          className="bg-slate-100 border-none text-[11px] rounded-full pl-3 pr-3 py-1 w-48"
                          placeholder="Filter current list..."
                          type="text"
                          value={memberFilter}
                          onChange={(e) => setMemberFilter(e.target.value)}
                        />
                        <Select value={sortBy} onValueChange={setSortBy}>
                          <SelectTrigger size="sm" className="bg-white border-slate-200 text-[11px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="name">Sort: Name</SelectItem>
                              <SelectItem value="role">Sort: Type</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="pb-2" />
                    )}
                  </div>

                  <TabsContent value="members" className="mt-0 flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar h-full">
                      {showStaleMembersError && (
                        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-200/70 bg-amber-50 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-amber-900">Members list may be stale</p>
                            <p className="text-[10px] text-amber-800/80 truncate">{membersError}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0 text-[10px]"
                            onClick={() => void refetchMembers()}
                          >
                            Retry
                          </Button>
                        </div>
                      )}
                      {membersLoading ? (
                        <div className="flex items-center justify-center py-16">
                          <Loader2 className="size-6 text-[var(--color-primary)] animate-spin mr-2" />
                          <span className="text-sm text-slate-500">Loading members…</span>
                        </div>
                      ) : showBlockingMembersError ? (
                        <div className="flex items-center justify-center py-16">
                          <AlertCircle className="size-5 text-[var(--color-error)] mr-2" />
                          <span className="text-sm text-slate-500">{membersError}</span>
                        </div>
                      ) : visibleMembers.length === 0 ? (
                        <div className="flex items-center justify-center py-16">
                          <div className="text-center">
                            <span className="text-sm text-slate-400">
                              {showStaleMembersError ? "Members list may be stale." : "No members found."}
                            </span>
                            {showStaleMembersError && (
                              <div className="mt-4">
                                <Button size="sm" onClick={() => void refetchMembers()}>
                                  Retry
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white border border-slate-200/60 rounded-lg overflow-hidden min-h-full">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-50/80 sticky top-0 z-10">
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Recipient Details</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right w-12"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {visibleMembers.map((member) => (
                                <TableRow
                                  key={member.exchangeIdentity}
                                  className="hover:bg-slate-50/50 transition-colors group"
                                >
                                  <TableCell>
                                    <div className="flex items-center gap-2.5">
                                      <Avatar className="w-6 h-6 text-[9px]">
                                        <AvatarFallback className={avatarColorFor(member.exchangeIdentity)}>
                                          {getInitials(member.displayName)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-xs font-bold text-slate-800">
                                        {member.displayName}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs text-slate-500 font-medium">
                                    {member.primaryEmail ?? "—"}
                                  </TableCell>
                                  <TableCell className="text-xs text-slate-500">
                                    {member.recipientTypeDetails || "—"}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="secondary"
                                      className="text-[9px] uppercase"
                                    >
                                      {RECIPIENT_TYPE_LABELS[member.recipientType]}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-[var(--color-error)]"
                                      onClick={() => setRemoveConfirmTarget(member)}
                                    >
                                      <UserMinus className="size-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="owners" className="mt-0 flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar h-full">
                      <div className="flex items-center justify-center py-16">
                        <span className="text-sm text-slate-400">Owner details are not yet available.</span>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="settings" className="mt-0 flex-1 overflow-hidden px-6 py-4">
                    <Card className={CONSOLE_SURFACE_CARD}>
                      <CardHeader className={CONSOLE_SURFACE_HEADER_COMPACT}>
                        <CardTitle className="text-sm font-bold text-slate-800">
                          Group Settings Snapshot
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-4 p-4 text-sm text-slate-600 md:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Group Type
                          </p>
                          <p className="mt-1 font-semibold text-slate-800">
                            {GROUP_KIND_LABELS[selectedGroup.groupKind]}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Member Count
                          </p>
                          <p className="mt-1 font-semibold text-slate-800">
                            {membersLoading ? "…" : members.length}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Managed By
                          </p>
                          <p className="mt-1">
                            {selectedGroup.managedByDisplayNames.length > 0
                              ? selectedGroup.managedByDisplayNames.join(", ")
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Alias
                          </p>
                          <p className="mt-1">
                            {selectedGroup.alias ?? "—"}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  </Tabs>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center py-16 px-8">
                  <Filter className="size-10 text-slate-300 mx-auto mb-4" />
                  <h2 className="text-lg font-bold font-headline text-slate-700 mb-2">
                    Select a Group
                  </h2>
                  <p className="text-sm text-slate-500 max-w-sm">
                    Choose a group from the list to view its details and members.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          handleMutationDialogOpenChange(open, addPending, () => setAddDialogOpen(false));
        }}
      >
        <DialogContent
          className="sm:max-w-lg max-h-[85vh] flex flex-col"
          showCloseButton={canDismissMutationDialog(addPending)}
        >
          <DialogHeader>
            <DialogTitle>Add Members to {selectedGroup?.displayName ?? "Group"}</DialogTitle>
            <DialogDescription>
              Search for recipients to add to this group. Exchange Direct and Graph guest recipients can be selected.
            </DialogDescription>
          </DialogHeader>

          {addResult ? (
            <div className="flex-1 overflow-y-auto space-y-2 py-2">
              {addResult.items.map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start gap-2 rounded-md px-3 py-2 text-xs",
                    isAddStatusClean(item.status)
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-red-50 text-red-800",
                  )}
                >
                  {isAddStatusClean(item.status) ? (
                    <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="size-4 shrink-0 mt-0.5 text-red-600" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold">{item.member.exchangeIdentity}</p>
                    <p className="text-[11px] opacity-80">
                      {ADD_STATUS_LABELS[item.status]}
                      {item.detail && item.detail !== ADD_STATUS_LABELS[item.status] && ` — ${item.detail}`}
                    </p>
                  </div>
                </div>
              ))}
              {addResult.verification && (
                <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                  Verification: {addResult.verification.verifiedAdded} of {addResult.summary.requested} confirmed added. {addResult.verification.detail}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 size-3.5" />
                <Input
                  className="w-full bg-slate-50 border-slate-200 rounded-md py-2 pl-8 pr-3 text-xs"
                  placeholder="Search by name or email (min 2 chars)..."
                  type="text"
                  value={addSearchQuery}
                  onChange={(e) => setAddSearchQuery(e.target.value)}
                  disabled={addPending}
                />
              </div>

              {addDegradationNote && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
                  <Info className="size-3.5 shrink-0" />
                  <span>{formatSourceDegradationNote(addDegradationNote)}</span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto min-h-0 -mx-4 px-4">
                {addSearchLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-5 text-[var(--color-primary)] animate-spin mr-2" />
                    <span className="text-sm text-slate-500">Searching…</span>
                  </div>
                )}
                {addSearchError && (
                  <div className="flex items-center justify-center py-8">
                    <AlertCircle className="size-5 text-[var(--color-error)] mr-2" />
                    <span className="text-sm text-slate-500">{addSearchError}</span>
                  </div>
                )}
                {!addSearchLoading && !addSearchError && addSearchQuery.trim().length >= 2 && addCandidates.length === 0 && (
                  <div className="flex items-center justify-center py-8">
                    <span className="text-sm text-slate-400">No recipients found.</span>
                  </div>
                )}
                {!addSearchLoading && addSearchQuery.trim().length < 2 && (
                  <div className="flex items-center justify-center py-8">
                    <span className="text-sm text-slate-400">Type at least 2 characters to search.</span>
                  </div>
                )}
                {addCandidates.map((candidate) => {
                  const selectable = isCandidateSelectable(candidate);
                  const disableReason = candidateDisableReason(candidate);
                  const selected = addSelectedKeys.has(candidate.stableKey);
                  return (
                    <div
                      key={candidate.stableKey}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-xs transition-colors",
                        selectable
                          ? "hover:bg-slate-50 cursor-pointer"
                          : "opacity-60 cursor-not-allowed",
                      )}
                      onClick={() => {
                        if (!selectable || addPending) return;
                        setAddSelectedKeys((prev) => {
                          const next = new Set(prev);
                          if (next.has(candidate.stableKey)) {
                            next.delete(candidate.stableKey);
                          } else {
                            next.add(candidate.stableKey);
                          }
                          return next;
                        });
                      }}
                    >
                      <Checkbox
                        checked={selected}
                        disabled={!selectable || addPending}
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800 truncate">{candidate.displayName}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {candidate.primaryEmail ?? "—"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5">
                          {RECIPIENT_SEARCH_TYPE_LABELS[candidate.recipientType]}
                        </Badge>
                        {disableReason && (
                          <span className="text-[10px] text-amber-600 font-medium">{disableReason}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {addError && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-error)] bg-red-50 rounded-md px-3 py-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{addError}</span>
            </div>
          )}

          <DialogFooter>
            {addResult ? (
              <Button size="sm" onClick={() => setAddDialogOpen(false)}>
                Close
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(false)} disabled={addPending}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={addSelectedKeys.size === 0 || addPending}
                  onClick={() => {
                    void handleAddMembers();
                  }}
                >
                  {addPending && <Loader2 className="size-3.5 mr-1 animate-spin" />}
                  Add {addSelectedKeys.size > 0 ? `${addSelectedKeys.size} Member${addSelectedKeys.size > 1 ? "s" : ""}` : "Members"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={removeConfirmTarget !== null}
        onOpenChange={(open) => {
          handleMutationDialogOpenChange(open, removePending, () => {
            setRemoveConfirmTarget(null);
            setRemoveResult(null);
            setRemoveError(null);
          });
        }}
      >
        <DialogContent
          className="sm:max-w-sm"
          showCloseButton={canDismissMutationDialog(removePending)}
        >
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              {removeConfirmTarget && (
                <>
                  Are you sure you want to remove{" "}
                  <span className="font-semibold">{removeConfirmTarget.displayName}</span>
                  {removeConfirmTarget.primaryEmail && (
                    <span className="text-slate-500"> ({removeConfirmTarget.primaryEmail})</span>
                  )}
                  {" "}from this group?
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {removeResult && (
            <div className="space-y-2 py-2">
              {removeResult.items.map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start gap-2 rounded-md px-3 py-2 text-xs",
                    isRemoveStatusClean(item.status)
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-red-50 text-red-800",
                  )}
                >
                  {isRemoveStatusClean(item.status) ? (
                    <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="size-4 shrink-0 mt-0.5 text-red-600" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold">{item.member.exchangeIdentity}</p>
                    <p className="text-[11px] opacity-80">
                      {REMOVE_STATUS_LABELS[item.status]}
                      {item.detail && item.detail !== REMOVE_STATUS_LABELS[item.status] && ` — ${item.detail}`}
                    </p>
                  </div>
                </div>
              ))}
              <div className="text-[11px] text-slate-500 pt-1">
                Verification: {removeResult.verification.detail}
              </div>
            </div>
          )}

          {removeError && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-error)] bg-red-50 rounded-md px-3 py-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{removeError}</span>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setRemoveConfirmTarget(null); setRemoveResult(null); setRemoveError(null); }}
              disabled={removePending}
            >
              {removeResult ? "Close" : "Cancel"}
            </Button>
            {!removeResult && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  void handleRemoveMember();
                }}
                disabled={removePending}
              >
                {removePending && <Loader2 className="size-3.5 mr-1 animate-spin" />}
                Remove
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
