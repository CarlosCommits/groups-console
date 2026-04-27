import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Search,
  Filter,
  UserPlus,
  UserMinus,
  RefreshCw,
  UsersRound,
  Loader2,
  AlertCircle,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/renderer/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/renderer/components/ui/select";
import { AppShell } from "@/renderer/components/console";
import { RecipientDetailDialog } from "@/renderer/components/console/directory/recipient-detail-dialog";
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
  formatSingleRemoveMemberSuccessDescription,
  getPrimaryRemoveMemberStatus,
  getRemoveMembersIssueDescriptions,
  getRemoveMembersIssueMessage,
  REMOVE_MEMBER_STATUS_LABELS,
} from "@/renderer/components/console/group-members-mutation-outcome";
import {
  CONSOLE_ROW_ACTION_ICON_BUTTON,
  CONSOLE_SURFACE_CARD,
  CONSOLE_SURFACE_HEADER_COMPACT,
} from "@/renderer/components/console/surface-styles";
import { toGroupMemberSelectionRef } from "@/renderer/lib/group-member-selection";
import { cn } from "@/renderer/lib/utils";
import { useApp } from "@/renderer/components/console/app-context";
import { toast } from "sonner";
import {
  useExchangeGroupsQuery,
} from "@/renderer/hooks/use-exchange-groups";
import {
  useGroupMembersQuery,
} from "@/renderer/hooks/use-group-members";
import {
  useContactDetailsQuery,
} from "@/renderer/hooks/use-contact-details";
import {
  useUpdateContactCompanyMutation,
} from "@/renderer/hooks/use-contact-mutations";
import {
  useGuestDetailsQuery,
} from "@/renderer/hooks/use-guest-details";
import {
  useUpdateGuestCompanyMutation,
} from "@/renderer/hooks/use-guest-mutations";
import {
  useExchangeRecipientDetailsQuery,
} from "@/renderer/hooks/use-exchange-recipient-details";
import {
  useGroupMembershipsQuery,
} from "@/renderer/hooks/use-group-memberships";
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
import type {
  ContactsUpdateCompanyResult,
} from "@/shared/contracts/contacts";
import type {
  GuestsUpdateCompanyResult,
} from "@/shared/contracts/guests";

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

const STICKY_TABLE_HEAD_CLASS = "sticky top-0 z-20 bg-slate-50/95";

const emailTruncationSubscribers = new Set<() => void>();
let emailTruncationResizeFrame: number | null = null;

function scheduleEmailTruncationMeasure() {
  if (emailTruncationResizeFrame !== null) return;
  emailTruncationResizeFrame = window.requestAnimationFrame(() => {
    emailTruncationResizeFrame = null;
    emailTruncationSubscribers.forEach((measure) => measure());
  });
}

function subscribeEmailTruncationMeasure(measure: () => void) {
  emailTruncationSubscribers.add(measure);

  if (emailTruncationSubscribers.size === 1) {
    window.addEventListener("resize", scheduleEmailTruncationMeasure);
  }

  return () => {
    emailTruncationSubscribers.delete(measure);

    if (emailTruncationSubscribers.size === 0) {
      window.removeEventListener("resize", scheduleEmailTruncationMeasure);

      if (emailTruncationResizeFrame !== null) {
        window.cancelAnimationFrame(emailTruncationResizeFrame);
        emailTruncationResizeFrame = null;
      }
    }
  };
}

function TruncatedTableText({ text, className }: { text: string; className: string }) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const measure = useCallback(() => {
    const textElement = textRef.current;
    if (!textElement) return;
    setIsTruncated(textElement.scrollWidth > textElement.clientWidth);
  }, []);

  useEffect(() => {
    measure();
    return subscribeEmailTruncationMeasure(measure);
  }, [text, measure]);

  const displayText = (
    <span ref={textRef} className={className}>
      {text}
    </span>
  );

  if (!isTruncated) {
    return displayText;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {displayText}
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function TruncatedEmailText({ email }: { email: string }) {
  return (
    <TruncatedTableText
      text={email}
      className="block max-w-72 truncate"
    />
  );
}

function TruncatedNameText({ name }: { name: string }) {
  return (
    <TruncatedTableText
      text={name}
      className="block max-w-52 truncate text-sm font-semibold text-slate-800"
    />
  );
}

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

function isCandidateSelectable(candidate: RecipientSearchItem): boolean {
  if (candidate.membershipSupport === "exchangeDirect" && candidate.exchangeIdentity !== null) {
    return true;
  }
  if (candidate.membershipSupport === "graphBridgeable" && candidate.objectId !== null) {
    return true;
  }
  return false;
}

function isMemberInspectable(member: GroupMemberListItem): boolean {
  return (
    member.recipientType === "mailbox" ||
    member.recipientType === "mailContact" ||
    member.recipientType === "mailUser" ||
    member.recipientType === "guestMailUser"
  );
}

function memberSearchTypes(member: GroupMemberListItem): RecipientSearchType[] {
  if (member.recipientType === "guestMailUser") {
    return ["guestUser", "guestMailUser", "mailUser"];
  }

  return [member.recipientType];
}

function memberToFallbackRecipient(member: GroupMemberListItem): RecipientSearchItem {
  const stableKey = member.objectId
    ? `exchange:objectId:${member.objectId}`
    : `exchange:identity:${member.exchangeIdentity}`;
  const isGuestMailUser = member.recipientType === "guestMailUser";

  return {
    source: "exchange",
    stableKey,
    recipientType: isGuestMailUser ? "guestUser" : member.recipientType,
    membershipSupport: isGuestMailUser ? "graphDeferred" : "exchangeDirect",
    objectId: member.objectId,
    exchangeIdentity: member.exchangeIdentity,
    primaryEmail: member.primaryEmail,
    displayName: member.displayName,
    alias: member.alias,
    recipientTypeDetails: member.recipientTypeDetails,
    companyName: null,
    companySource: "none",
  };
}

function findBestRecipientMatch(
  member: GroupMemberListItem,
  result: RecipientsSearchResult,
): RecipientSearchItem | null {
  const normalizedEmail = member.primaryEmail?.trim().toLowerCase() ?? null;
  const normalizedExchangeIdentity = member.exchangeIdentity.trim().toLowerCase();
  const normalizedObjectId = member.objectId?.trim().toLowerCase() ?? null;
  const matches = result.items.filter((item) =>
    (normalizedObjectId !== null && item.objectId?.trim().toLowerCase() === normalizedObjectId) ||
    item.exchangeIdentity?.trim().toLowerCase() === normalizedExchangeIdentity ||
    (normalizedEmail !== null && item.primaryEmail?.trim().toLowerCase() === normalizedEmail),
  );

  if (member.recipientType === "guestMailUser") {
    return matches.find((item) => item.recipientType === "guestUser") ?? matches[0] ?? null;
  }

  return matches[0] ?? null;
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

function canUpdateCompany(
  item: RecipientSearchItem,
  exchangeConnected: boolean,
  graphConnected: boolean,
  graphTenantMatched: boolean,
): boolean {
  if (
    item.recipientType === "mailContact" &&
    item.exchangeIdentity !== null &&
    exchangeConnected
  ) {
    return true;
  }
  if (
    item.recipientType === "guestUser" &&
    item.objectId !== null &&
    graphConnected &&
    graphTenantMatched
  ) {
    return true;
  }
  return false;
}

function getUpdateMode(item: RecipientSearchItem): "contact" | "guest" {
  if (item.recipientType === "mailContact") return "contact";
  return "guest";
}

function isAddStatusClean(status: GroupsAddMembersResult["items"][number]["status"]): boolean {
  return status === "added" || status === "alreadyMember";
}

function getAddMembersIssueMessage(result: GroupsAddMembersResult): string | null {
  const issue = result.items.find((item) => !isAddStatusClean(item.status));
  if (!issue) {
    return null;
  }

  const label = issue.member.primaryEmail ?? issue.member.exchangeIdentity;
  return `${label}: ${ADD_STATUS_LABELS[issue.status]}: ${issue.detail}`;
}

function showAddMembersToast(groupName: string, result: GroupsAddMembersResult): void {
  const issues = result.items.filter((item) => !isAddStatusClean(item.status));

  if (issues.length > 0) {
    toast.warning("Some members need attention", {
      description: issues
        .map((item) => {
          const label = item.member.primaryEmail ?? item.member.exchangeIdentity;
          return `${label}: ${ADD_STATUS_LABELS[item.status]} - ${item.detail}`;
        })
        .join("\n"),
    });
    return;
  }

  const addedCount = result.items.filter((item) => item.status === "added").length;
  const alreadyMemberCount = result.items.filter((item) => item.status === "alreadyMember").length;

  if (addedCount > 0 && alreadyMemberCount === 0) {
    toast.success(addedCount === 1 ? "Member added" : "Members added", {
      description: `${addedCount} member${addedCount === 1 ? "" : "s"} added to ${groupName}`,
    });
    return;
  }

  if (addedCount === 0) {
    toast.success("Already a member", {
      description: `${result.items.length} member${result.items.length === 1 ? "" : "s"} already in ${groupName}`,
    });
    return;
  }

  toast.success("Memberships updated", {
    description: `${addedCount} added; ${alreadyMemberCount} already in ${groupName}`,
  });
}

function showRemoveMemberToast(
  memberName: string,
  groupName: string,
  result: GroupsRemoveMembersResult,
): void {
  const issues = getRemoveMembersIssueDescriptions(result);

  if (issues.length > 0) {
    toast.warning("Remove member needs attention", {
      description: issues.join("\n"),
    });
    return;
  }

  const status = getPrimaryRemoveMemberStatus(result, "removed");
  toast.success(REMOVE_MEMBER_STATUS_LABELS[status], {
    description: formatSingleRemoveMemberSuccessDescription(memberName, groupName, result),
  });
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
  const { shell, groupsScreenState, setGroupsScreenState } = useApp();
  const exchangeConnection = shell.exchangeConnection;
  const exchangeConnected = exchangeConnection?.state === "connected";
  const graphConnected = shell.graphConnection?.state === "connected";
  const graphTenantMatched = shell.graphConnection?.exchangeAlignment === "matched";
  const {
    groups,
    appliedKind,
    isLoading: groupsLoading,
    error: groupsError,
    refetch: refetchGroups,
  } = useExchangeGroupsQuery(exchangeConnection);

  const {
    selectedGroupExchangeIdentity,
    activeTab,
    sortBy,
    groupFilter,
    memberFilter,
  } = groupsScreenState;
  const setSelectedGroupExchangeIdentity = useCallback((value: string | null) => {
    setGroupsScreenState((previous) => ({
      ...previous,
      selectedGroupExchangeIdentity: value,
    }));
  }, [setGroupsScreenState]);
  const setActiveTab = useCallback((value: string) => {
    setGroupsScreenState((previous) => ({
      ...previous,
      activeTab: value,
    }));
  }, [setGroupsScreenState]);
  const setSortBy = useCallback((value: string) => {
    setGroupsScreenState((previous) => ({
      ...previous,
      sortBy: value,
    }));
  }, [setGroupsScreenState]);
  const setGroupFilter = useCallback((value: string) => {
    setGroupsScreenState((previous) => ({
      ...previous,
      groupFilter: value,
    }));
  }, [setGroupsScreenState]);
  const setMemberFilter = useCallback((value: string) => {
    setGroupsScreenState((previous) => ({
      ...previous,
      memberFilter: value,
    }));
  }, [setGroupsScreenState]);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState("");
  const [addCandidates, setAddCandidates] = useState<RecipientSearchItem[]>([]);
  const [addSelectedKeys, setAddSelectedKeys] = useState<Set<string>>(new Set());
  const [addSearchLoading, setAddSearchLoading] = useState(false);
  const [addSearchError, setAddSearchError] = useState<string | null>(null);
  const [addSearchResult, setAddSearchResult] = useState<RecipientsSearchResult | null>(null);
  const [addPending, setAddPending] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [removeConfirmTarget, setRemoveConfirmTarget] = useState<GroupMemberListItem | null>(null);
  const [removePending, setRemovePending] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<RecipientSearchItem | null>(null);
  const [detailResolvePendingKey, setDetailResolvePendingKey] = useState<string | null>(null);
  const [detailResolveError, setDetailResolveError] = useState<string | null>(null);
  const [groupFilterText, setGroupFilterText] = useState("");
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<Set<string>>(new Set());
  const [addGroupPending, setAddGroupPending] = useState(false);
  const [addGroupError, setAddGroupError] = useState<string | null>(null);
  const [removeMembershipGroupTarget, setRemoveMembershipGroupTarget] = useState<ExchangeGroupListItem | null>(null);
  const detailResolveTokenRef = useRef(0);

  const hasGroupsData = appliedKind !== null;
  const showStaleGroupsError = groupsError !== null && hasGroupsData;
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

  const selectedGroup = useMemo(() => {
    if (filteredGroups.length === 0) {
      return null;
    }

    return (
      filteredGroups.find(
        (group) => group.exchangeIdentity === selectedGroupExchangeIdentity,
      ) ?? filteredGroups[0]
    );
  }, [filteredGroups, selectedGroupExchangeIdentity]);

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
  const updateContactCompanyMutation = useUpdateContactCompanyMutation(
    exchangeConnection,
    shell.graphConnection,
  );
  const updateGuestCompanyMutation = useUpdateGuestCompanyMutation(
    exchangeConnection,
    shell.graphConnection,
  );
  const normalizedActiveTab = activeTab === "settings" ? "details" : activeTab;
  const detailResolved = detailDialogOpen && detailResolvePendingKey === null && detailResolveError === null;

  const contactDetailsQuery = useContactDetailsQuery(
    exchangeConnection,
    detailTarget?.recipientType === "mailContact" ? detailTarget.stableKey : undefined,
    detailResolved && detailTarget?.recipientType === "mailContact",
  );
  const guestDetailsQuery = useGuestDetailsQuery(
    shell.graphConnection,
    detailTarget?.recipientType === "guestUser" ? detailTarget.stableKey : undefined,
    detailResolved && detailTarget?.recipientType === "guestUser",
  );
  const exchangeRecipientDetailsQuery = useExchangeRecipientDetailsQuery(
    exchangeConnection,
    detailTarget?.recipientType === "mailbox" || detailTarget?.recipientType === "mailUser"
      ? detailTarget.stableKey
      : undefined,
    detailResolved &&
      (detailTarget?.recipientType === "mailbox" || detailTarget?.recipientType === "mailUser"),
  );

  const detailMemberSelectionRef = useMemo((): GroupMemberSelectionRef | null => {
    if (!detailTarget) return null;
    return toGroupMemberSelectionRef(detailTarget);
  }, [detailTarget]);
  const membershipsQuery = useGroupMembershipsQuery(
    exchangeConnection,
    detailMemberSelectionRef,
    detailResolved && !!detailMemberSelectionRef,
  );
  const detailMembershipsLoading = detailResolvePendingKey !== null || membershipsQuery.isLoading;
  const membershipMember = membershipsQuery.member;
  const refetchMemberships = membershipsQuery.refetch;

  const currentMemberships = membershipsQuery.groups;
  const currentMembershipKeys = useMemo(
    () => new Set(currentMemberships.map((group) => group.exchangeIdentity)),
    [currentMemberships],
  );
  const availableGroups = useMemo(
    () => groups.filter((group) => !currentMembershipKeys.has(group.exchangeIdentity)),
    [currentMembershipKeys, groups],
  );
  const filteredAvailableGroups = useMemo(() => {
    const filter = groupFilterText.trim().toLowerCase();
    if (!filter) return availableGroups;
    return availableGroups.filter((group) =>
      [
        group.displayName,
        group.exchangeIdentity,
        group.primaryEmail ?? "",
        group.alias ?? "",
      ].join(" ").toLowerCase().includes(filter),
    );
  }, [availableGroups, groupFilterText]);
  const visibleSelectedGroupsCount = useMemo(
    () => filteredAvailableGroups.filter((group) => selectedGroupKeys.has(group.exchangeIdentity)).length,
    [filteredAvailableGroups, selectedGroupKeys],
  );
  const hasHiddenSelectedGroups = selectedGroupKeys.size > visibleSelectedGroupsCount;
  const [updateCompanyName, setUpdateCompanyName] = useState("");
  const [updatePending, setUpdatePending] = useState(false);
  const [updateResult, setUpdateResult] = useState<
    | { mode: "contact"; data: ContactsUpdateCompanyResult }
    | { mode: "guest"; data: GuestsUpdateCompanyResult }
    | null
  >(null);

  const activeDetailState = useMemo(() => {
    if (detailResolvePendingKey !== null) {
      return {
        pending: true,
        error: null,
        result: null,
        refetch: () => Promise.resolve(undefined),
      };
    }

    if (detailResolveError !== null) {
      return {
        pending: false,
        error: detailResolveError,
        result: null,
        refetch: () => Promise.resolve(undefined),
      };
    }

    if (detailTarget?.recipientType === "mailContact") {
      return {
        pending: contactDetailsQuery.isLoading,
        error: contactDetailsQuery.error,
        result: contactDetailsQuery.contact
          ? ({ mode: "contact", data: contactDetailsQuery.contact } as const)
          : null,
        refetch: contactDetailsQuery.refetch,
      };
    }

    if (detailTarget?.recipientType === "guestUser") {
      return {
        pending: guestDetailsQuery.isLoading,
        error: guestDetailsQuery.error,
        result: guestDetailsQuery.guest
          ? ({ mode: "guest", data: guestDetailsQuery.guest } as const)
          : null,
        refetch: guestDetailsQuery.refetch,
      };
    }

    if (detailTarget?.recipientType === "mailbox" || detailTarget?.recipientType === "mailUser") {
      return {
        pending: exchangeRecipientDetailsQuery.isLoading,
        error: exchangeRecipientDetailsQuery.error,
        result: exchangeRecipientDetailsQuery.recipient
          ? ({ mode: "exchangeRecipient", data: exchangeRecipientDetailsQuery.recipient } as const)
          : null,
        refetch: exchangeRecipientDetailsQuery.refetch,
      };
    }

    return {
      pending: false,
      error: detailTarget ? "Details are not available for this recipient type." : null,
      result: null,
      refetch: () => Promise.resolve(undefined),
    };
  }, [
    contactDetailsQuery.contact,
    contactDetailsQuery.error,
    contactDetailsQuery.isLoading,
    contactDetailsQuery.refetch,
    detailResolveError,
    detailResolvePendingKey,
    detailTarget,
    exchangeRecipientDetailsQuery.error,
    exchangeRecipientDetailsQuery.isLoading,
    exchangeRecipientDetailsQuery.recipient,
    exchangeRecipientDetailsQuery.refetch,
    guestDetailsQuery.error,
    guestDetailsQuery.guest,
    guestDetailsQuery.isLoading,
    guestDetailsQuery.refetch,
  ]);

  const detailCanUpdateCompany = detailTarget
    ? canUpdateCompany(
        detailTarget,
        exchangeConnected,
        graphConnected,
        graphTenantMatched,
      )
    : false;

  useEffect(() => {
    if (groupsLoading) {
      return;
    }

    if (filteredGroups.length === 0) {
      setSelectedGroupExchangeIdentity(null);
      return;
    }

    const stillVisible = filteredGroups.some(
      (group) => group.exchangeIdentity === selectedGroupExchangeIdentity,
    );

    if (!stillVisible) {
      setSelectedGroupExchangeIdentity(filteredGroups[0].exchangeIdentity);
    }
  }, [
    filteredGroups,
    groupsLoading,
    selectedGroupExchangeIdentity,
    setSelectedGroupExchangeIdentity,
  ]);

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
      window.groupsConsole.recipients
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
    try {
      const result = await addGroupMembersMutation.mutateAsync({
        groupRef,
        memberRefs,
      });
      showAddMembersToast(selectedGroup.displayName, result);
      const issueMessage = getAddMembersIssueMessage(result);
      if (issueMessage) {
        setAddError(issueMessage);
      } else {
        setAddSelectedKeys(new Set());
        setAddDialogOpen(false);
      }
    } catch (err) {
      const message = formatPresentedCommandFailure(
        presentCommandFailure(err, "Add Members Error", "Failed to add members."),
      );
      setAddError(message);
      toast.error("Failed to add members", { description: message });
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
    try {
      const result = await removeGroupMembersMutation.mutateAsync({
        groupRef,
        memberRefs: [memberRef],
      });
      showRemoveMemberToast(removeConfirmTarget.displayName, selectedGroup.displayName, result);
      const issueMessage = getRemoveMembersIssueMessage(result);
      if (issueMessage) {
        setRemoveError(issueMessage);
      } else {
        setRemoveConfirmTarget(null);
      }
    } catch (err) {
      const message = formatPresentedCommandFailure(
        presentCommandFailure(err, "Remove Member Error", "Failed to remove member."),
      );
      setRemoveError(message);
      toast.error("Failed to remove member", { description: message });
    } finally {
      setRemovePending(false);
    }
  }, [selectedGroup, removeConfirmTarget, removeGroupMembersMutation]);

  const handleUpdateSubmit = useCallback(async () => {
    if (!detailTarget) return;
    setUpdatePending(true);
    setUpdateResult(null);
    try {
      const mode = getUpdateMode(detailTarget);
      if (mode === "contact") {
        const result = await updateContactCompanyMutation.mutateAsync({
          payload: {
            exchangeIdentity: detailTarget.exchangeIdentity!,
            companyName: updateCompanyName.trim(),
          },
          stableKey: detailTarget.stableKey,
        });
        setUpdateResult({ mode: "contact", data: result });
        if (result.verification.companyApplied) {
          toast.success("Company updated", { description: result.verification.detail });
        } else {
          toast.warning("Company update needs attention", { description: result.verification.detail });
        }
      } else {
        const result = await updateGuestCompanyMutation.mutateAsync({
          payload: {
            guestUserId: detailTarget.objectId!,
            companyName: updateCompanyName.trim(),
          },
          stableKey: detailTarget.stableKey,
        });
        setUpdateResult({ mode: "guest", data: result });
        if (result.verification.companyApplied) {
          toast.success("Company updated", { description: result.verification.detail });
        } else {
          toast.warning("Company update needs attention", { description: result.verification.detail });
        }
      }
    } catch (err) {
      const message = formatPresentedCommandFailure(
        presentCommandFailure(err, "Update Error", "Operation failed."),
      );
      toast.error("Failed to update company", { description: message });
    } finally {
      setUpdatePending(false);
    }
  }, [
    detailTarget,
    updateCompanyName,
    updateContactCompanyMutation,
    updateGuestCompanyMutation,
  ]);

  const openMemberDetailDialog = useCallback(async (member: GroupMemberListItem) => {
    if (!isMemberInspectable(member)) return;

    const resolveToken = detailResolveTokenRef.current + 1;
    detailResolveTokenRef.current = resolveToken;
    const fallbackTarget = memberToFallbackRecipient(member);
    setDetailTarget(fallbackTarget);
    setDetailDialogOpen(true);
    setDetailResolvePendingKey(member.exchangeIdentity);
    setDetailResolveError(null);
    setGroupFilterText("");
    setSelectedGroupKeys(new Set());
    setAddGroupError(null);
    setUpdateCompanyName(fallbackTarget.companyName ?? "");
    setUpdateResult(null);
    setUpdatePending(false);

    try {
      const result = await window.groupsConsole.recipients.search({
        query: member.primaryEmail ?? member.displayName,
        types: memberSearchTypes(member),
        limit: 25,
      });
      const match = findBestRecipientMatch(member, result);
      if (detailResolveTokenRef.current !== resolveToken) return;
      if (!match) {
        setDetailTarget(fallbackTarget);
        setDetailResolveError(
          member.recipientType === "guestMailUser"
            ? "Guest details require a matching Microsoft Graph guest record."
            : "Could not resolve this member in directory search. Refresh the group and try again.",
        );
        return;
      }
      setDetailTarget(match);
      setUpdateCompanyName(match.companyName ?? "");
    } catch (err) {
      if (detailResolveTokenRef.current !== resolveToken) return;
      const message = formatPresentedCommandFailure(
        presentCommandFailure(err, "Detail Error", "Failed to resolve member details."),
      );
      setDetailResolveError(message);
    } finally {
      if (detailResolveTokenRef.current === resolveToken) {
        setDetailResolvePendingKey(null);
      }
    }
  }, []);

  const handleDetailClose = useCallback(() => {
    detailResolveTokenRef.current += 1;
    setDetailDialogOpen(false);
    setDetailTarget(null);
    setDetailResolvePendingKey(null);
    setDetailResolveError(null);
    setGroupFilterText("");
    setSelectedGroupKeys(new Set());
    setAddGroupPending(false);
    setAddGroupError(null);
    setUpdateCompanyName("");
    setUpdateResult(null);
    setUpdatePending(false);
  }, []);

  const handleToggleGroupSelection = useCallback((exchangeIdentity: string) => {
    setSelectedGroupKeys((previous) => {
      const next = new Set(previous);
      if (next.has(exchangeIdentity)) {
        next.delete(exchangeIdentity);
      } else {
        next.add(exchangeIdentity);
      }
      return next;
    });
  }, []);

  const handleSelectAllFiltered = useCallback(() => {
    setSelectedGroupKeys((previous) => {
      const next = new Set(previous);
      filteredAvailableGroups.forEach((group) => next.add(group.exchangeIdentity));
      return next;
    });
  }, [filteredAvailableGroups]);

  const handleClearSelection = useCallback(() => {
    setSelectedGroupKeys(new Set());
  }, []);

  const handleAddGroupsFromDetail = useCallback(async () => {
    if (!detailMemberSelectionRef) return;
    const selectedGroups = groups.filter((group) => selectedGroupKeys.has(group.exchangeIdentity));
    if (selectedGroups.length === 0) return;

    setAddGroupPending(true);
    setAddGroupError(null);
    try {
      const successfulResults = [];
      const failedResults: string[] = [];

      for (const group of selectedGroups) {
        try {
          const result = await addGroupMembersMutation.mutateAsync({
            groupRef: groupRefFromListItem(group),
            memberRefs: [detailMemberSelectionRef],
          });
          successfulResults.push({ group, result });
        } catch (err) {
          const message = formatPresentedCommandFailure(
            presentCommandFailure(err, "Add Groups Error", `Failed to add member to ${group.displayName}.`),
          );
          failedResults.push(`${group.displayName}: ${message}`);
        }
      }

      const itemIssues = successfulResults.flatMap(({ group, result }) =>
        result.items
          .filter((item) => !isAddStatusClean(item.status))
          .map((item) => `${group.displayName}: ${ADD_STATUS_LABELS[item.status]} - ${item.detail}`),
      );
      const issues = [...failedResults, ...itemIssues];

      if (issues.length > 0) {
        const hiddenIssueCount = Math.max(issues.length - 3, 0);
        const issueMessage = [
          ...issues.slice(0, 3),
          ...(hiddenIssueCount > 0 ? [`${hiddenIssueCount} more issue${hiddenIssueCount === 1 ? "" : "s"}.`] : []),
        ].join("\n");
        setAddGroupError(issueMessage);
        await refetchMemberships();
        if (successfulResults.length > 0) {
          toast.warning("Some groups were not updated", { description: issueMessage });
        } else {
          toast.error("Failed to add groups", { description: issueMessage });
        }
      } else {
        setSelectedGroupKeys(new Set());
        await refetchMemberships();
        toast.success("Group memberships updated", {
          description: `${selectedGroups.length} group${selectedGroups.length === 1 ? "" : "s"} updated.`,
        });
      }
    } catch (err) {
      const message = formatPresentedCommandFailure(
        presentCommandFailure(err, "Add Groups Error", "Failed to add member to selected groups."),
      );
      setAddGroupError(message);
      toast.error("Failed to add groups", { description: message });
    } finally {
      setAddGroupPending(false);
    }
  }, [
    addGroupMembersMutation,
    detailMemberSelectionRef,
    groups,
    refetchMemberships,
    selectedGroupKeys,
  ]);

  const handleRemoveMembershipGroup = useCallback(async () => {
    if (!membershipMember || !removeMembershipGroupTarget) {
      return;
    }

    const memberRef: GroupMemberWriteRef = {
      exchangeIdentity: membershipMember.exchangeIdentity,
      objectId: membershipMember.objectId,
      primaryEmail: membershipMember.primaryEmail,
    };

    setRemovePending(true);
    setRemoveError(null);
    try {
      const result = await removeGroupMembersMutation.mutateAsync({
        groupRef: groupRefFromListItem(removeMembershipGroupTarget),
        memberRefs: [memberRef],
      });
      showRemoveMemberToast(detailTarget?.displayName ?? "Member", removeMembershipGroupTarget.displayName, result);
      const issueMessage = getRemoveMembersIssueMessage(result);
      if (issueMessage) {
        setRemoveError(issueMessage);
      } else {
        setRemoveMembershipGroupTarget(null);
        await refetchMemberships();
        void refetchMembers();
      }
    } catch (err) {
      const message = formatPresentedCommandFailure(
        presentCommandFailure(err, "Remove Member Error", "Failed to remove member."),
      );
      setRemoveError(message);
      toast.error("Failed to remove member", { description: message });
    } finally {
      setRemovePending(false);
    }
  }, [
    detailTarget?.displayName,
    membershipMember,
    refetchMembers,
    refetchMemberships,
    removeGroupMembersMutation,
    removeMembershipGroupTarget,
  ]);

  if (!exchangeConnected) {
    return (
      <AppShell>
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
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
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
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
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
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
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
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
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex flex-1 overflow-hidden rounded-xl border border-[var(--color-outline-variant)]/20 bg-white shadow-sm">
          <section className="w-96 flex flex-col bg-slate-50 border-r border-slate-200/50 flex-none h-full">
            <div className="p-4 bg-white border-b border-slate-200/50 flex-none">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-headline text-base font-bold text-[var(--color-foreground)]">
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
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 size-3" />
                <Input
                  className="w-full bg-slate-100 border-none rounded-md py-2 pl-8 pr-3 text-sm"
                  placeholder="Filter groups..."
                  type="text"
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <Table containerClassName="overflow-x-visible">
                <TableHeader className="bg-slate-50/95 shadow-[0_1px_0_rgba(148,163,184,0.25)]">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={cn(STICKY_TABLE_HEAD_CLASS, "h-11 w-full px-3 text-sm font-bold text-slate-700")}>Display Name</TableHead>
                    <TableHead className={cn(STICKY_TABLE_HEAD_CLASS, "h-11 px-3 text-sm font-bold text-slate-700")}>Type</TableHead>
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
                      onClick={() => setSelectedGroupExchangeIdentity(group.exchangeIdentity)}
                    >
                      <TableCell className="px-3 py-3">
                        <p
                          className={cn(
                            "text-sm truncate",
                            selectedGroup?.exchangeIdentity === group.exchangeIdentity
                              ? "font-bold text-[var(--color-primary)]"
                              : "font-semibold text-slate-700"
                          )}
                        >
                          {group.displayName}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {group.primaryEmail ?? "—"}
                        </p>
                      </TableCell>
                      <TableCell className="px-3 py-3">
                        <Badge
                          variant="secondary"
                          className="px-2 py-0.5 text-[11px]"
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
                <div className="bg-white px-6 py-5 border-b border-slate-200/50 flex-none">
                  <div className="flex justify-between items-start">
                    <div className="flex min-w-0 gap-4">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-[var(--color-primary)]/15 bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                        <UsersRound className="size-6" />
                      </div>
                      <div className="min-w-0">
                        <div className="min-w-0">
                          <h2 className="truncate text-xl font-extrabold font-headline tracking-tight">
                            {selectedGroup.displayName}
                          </h2>
                        </div>
                        <p className="text-sm text-slate-500 max-w-lg mt-0.5 truncate">
                          {selectedGroup.primaryEmail ?? selectedGroup.alias ?? "—"}
                        </p>
                        <div className="mt-3 grid grid-cols-[auto_auto] items-baseline gap-x-3 gap-y-2 sm:grid-cols-[auto_auto_auto_auto_auto_auto]">
                          <div className="contents">
                            <span className="text-xs uppercase font-bold text-slate-500 text-right">
                              Type:
                            </span>
                            <span className="text-sm font-semibold text-slate-700">
                              {GROUP_KIND_LABELS[selectedGroup.groupKind]} Group
                            </span>
                          </div>
                          <div className="contents">
                            <span className="text-xs uppercase font-bold text-slate-500 text-right">
                              Total Members:
                            </span>
                            <span className="text-sm font-extrabold font-headline text-slate-900">
                              {membersLoading ? "…" : members.length}
                            </span>
                          </div>
                          {selectedGroup.whenChangedUtc && (
                            <div className="contents">
                              <span className="text-xs uppercase font-bold text-slate-500 text-right">
                                Modified:
                              </span>
                              <span className="text-sm text-slate-700">
                                {new Date(selectedGroup.whenChangedUtc).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="default" className="text-sm" onClick={openAddDialog} disabled={!selectedGroup}>
                        <UserPlus className="size-4 mr-1" />
                        Add Member
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="text-sm"
                        disabled={!selectedGroup || membersFetching}
                        onClick={() => void refetchMembers()}
                        aria-label="Refresh members"
                        title="Refresh members"
                      >
                        <RefreshCw className={cn("size-4", membersFetching && "animate-spin")} />
                      </Button>
                    </div>
                  </div>
                </div>

                <Tabs
                  value={normalizedActiveTab}
                  onValueChange={setActiveTab}
                  className="flex flex-1 flex-col gap-0 overflow-hidden"
                >
                  <div className="px-6 py-3 flex items-center justify-between border-b border-slate-200/50 flex-none bg-white">
                    <TabsList className="h-9 bg-slate-100 p-1">
                      <TabsTrigger
                        value="members"
                        className="h-7 min-w-28 rounded-md px-3 py-1 text-sm font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-[var(--color-primary)] data-[state=active]:shadow-sm hover:text-slate-800"
                      >
                        Members{!membersLoading ? ` (${members.length})` : ""}
                      </TabsTrigger>
                      <TabsTrigger
                        value="owners"
                        className="h-7 min-w-24 rounded-md px-3 py-1 text-sm font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-[var(--color-primary)] data-[state=active]:shadow-sm hover:text-slate-800"
                      >
                        Owners
                      </TabsTrigger>
                      <TabsTrigger
                        value="details"
                        className="h-7 min-w-24 rounded-md px-3 py-1 text-sm font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-[var(--color-primary)] data-[state=active]:shadow-sm hover:text-slate-800"
                      >
                        Details
                      </TabsTrigger>
                    </TabsList>
                    {normalizedActiveTab === "members" ? (
                      <div className="flex items-center gap-2">
                        <Input
                          className="bg-slate-100 border-none text-sm rounded-full pl-4 pr-4 py-2 w-64"
                          placeholder="Filter current list..."
                          type="text"
                          value={memberFilter}
                          onChange={(e) => setMemberFilter(e.target.value)}
                        />
                        <Select value={sortBy} onValueChange={setSortBy}>
                          <SelectTrigger size="sm" className="bg-white border-slate-200 text-sm">
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

                  <TabsContent value="members" className="mt-0 min-h-0 flex-1 overflow-hidden">
                    <div className="h-full overflow-y-auto custom-scrollbar">
                      {showStaleMembersError && (
                        <div className="mx-6 mt-4 mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-200/70 bg-amber-50 px-3 py-2">
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
                        <div className="flex items-center justify-center px-6 py-16">
                          <Loader2 className="size-6 text-[var(--color-primary)] animate-spin mr-2" />
                          <span className="text-sm text-slate-500">Loading members…</span>
                        </div>
                      ) : showBlockingMembersError ? (
                        <div className="flex items-center justify-center px-6 py-16">
                          <AlertCircle className="size-5 text-[var(--color-error)] mr-2" />
                          <span className="text-sm text-slate-500">{membersError}</span>
                        </div>
                      ) : visibleMembers.length === 0 ? (
                        <div className="flex items-center justify-center px-6 py-16">
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
                        <div className="min-h-full w-full border-y border-slate-200/70 bg-white">
                          <Table className="text-sm" containerClassName="overflow-x-visible">
                            <TableHeader className="bg-slate-50/95 shadow-[0_1px_0_rgba(148,163,184,0.35)]">
                              <TableRow className="hover:bg-transparent">
                                <TableHead className={cn(STICKY_TABLE_HEAD_CLASS, "w-64 max-w-64 text-[11px] font-semibold uppercase tracking-wide text-slate-500")}>Name</TableHead>
                                <TableHead className={cn(STICKY_TABLE_HEAD_CLASS, "w-72 max-w-72 text-[11px] font-semibold uppercase tracking-wide text-slate-500")}>Email</TableHead>
                                <TableHead className={cn(STICKY_TABLE_HEAD_CLASS, "text-[11px] font-semibold uppercase tracking-wide text-slate-500")}>Recipient Details</TableHead>
                                <TableHead className={cn(STICKY_TABLE_HEAD_CLASS, "text-[11px] font-semibold uppercase tracking-wide text-slate-500")}>Type</TableHead>
                                <TableHead className={cn(STICKY_TABLE_HEAD_CLASS, "w-10 text-right")}></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TooltipProvider>
                                {visibleMembers.map((member) => (
                                <TableRow
                                  key={member.exchangeIdentity}
                                  className={cn(
                                    "hover:bg-slate-50/60 transition-colors group",
                                    isMemberInspectable(member) && "cursor-pointer",
                                  )}
                                  tabIndex={isMemberInspectable(member) ? 0 : undefined}
                                  role={isMemberInspectable(member) ? "button" : undefined}
                                  onClick={() => {
                                    if (isMemberInspectable(member)) {
                                      void openMemberDetailDialog(member);
                                    }
                                  }}
                                  onKeyDown={(event) => {
                                    if (!isMemberInspectable(member)) return;
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      void openMemberDetailDialog(member);
                                    }
                                  }}
                                >
                                  <TableCell className="w-64 max-w-64">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <Avatar className="size-6 text-[10px]">
                                        <AvatarFallback className={avatarColorFor(member.exchangeIdentity)}>
                                          {getInitials(member.displayName)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <TruncatedNameText name={member.displayName} />
                                    </div>
                                  </TableCell>
                                  <TableCell className="w-72 max-w-72 text-sm text-slate-600 font-medium">
                                    {member.primaryEmail ? (
                                      <TruncatedEmailText email={member.primaryEmail} />
                                    ) : (
                                      "-"
                                    )}
                                  </TableCell>
                                  <TableCell className="text-sm text-slate-600">
                                    {member.recipientTypeDetails || "—"}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="secondary"
                                      className="text-[11px] uppercase"
                                    >
                                      {RECIPIENT_TYPE_LABELS[member.recipientType]}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      className={CONSOLE_ROW_ACTION_ICON_BUTTON}
                                      aria-label={`Remove ${member.displayName} from ${selectedGroup.displayName}`}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setRemoveMembershipGroupTarget(null);
                                        setRemoveError(null);
                                        setRemoveConfirmTarget(member);
                                      }}
                                    >
                                      <UserMinus className="size-5" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                                ))}
                              </TooltipProvider>
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

                  <TabsContent value="details" className="mt-0 flex-1 overflow-hidden px-6 py-4">
                    <Card className={CONSOLE_SURFACE_CARD}>
                      <CardHeader className={CONSOLE_SURFACE_HEADER_COMPACT}>
                        <CardTitle className="text-base font-bold text-slate-800">
                          Group Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-5 p-4 text-sm text-slate-600 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Group Type
                          </p>
                          <p className="mt-1 text-base font-semibold text-slate-800">
                            {GROUP_KIND_LABELS[selectedGroup.groupKind]}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Member Count
                          </p>
                          <p className="mt-1 text-base font-semibold text-slate-800">
                            {membersLoading ? "…" : members.length}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Managed By
                          </p>
                          <p className="mt-1">
                            {selectedGroup.managedByDisplayNames.length > 0
                              ? selectedGroup.managedByDisplayNames.join(", ")
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Alias
                          </p>
                          <p className="mt-1">
                            {selectedGroup.alias ?? "—"}
                          </p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            ID
                          </p>
                          <p className="mt-1 rounded-md bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700 [overflow-wrap:anywhere]">
                            {selectedGroup.objectId ?? selectedGroup.exchangeIdentity}
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

          {addError && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-error)] bg-red-50 rounded-md px-3 py-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{addError}</span>
            </div>
          )}

          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RecipientDetailDialog
        open={detailDialogOpen}
        onOpenChange={(open) => {
          if (!open && canDismissMutationDialog(addGroupPending || removePending || updatePending)) {
            handleDetailClose();
          }
        }}
        canDismiss={canDismissMutationDialog(addGroupPending || removePending || updatePending)}
        detailTarget={detailTarget}
        detailPending={activeDetailState.pending}
        detailError={activeDetailState.error}
        detailResult={activeDetailState.result}
        onRefetchDetails={() => {
          void activeDetailState.refetch();
        }}
        detailCanUpdateCompany={detailCanUpdateCompany}
        updateCompanyName={updateCompanyName}
        onUpdateCompanyNameChange={setUpdateCompanyName}
        updatePending={updatePending}
        onUpdateSubmit={() => {
          void handleUpdateSubmit();
        }}
        updateResult={updateResult}
        memberSelectionRef={detailMemberSelectionRef}
        membershipsLoading={detailMembershipsLoading}
        membershipsError={membershipsQuery.error}
        currentMemberships={currentMemberships}
        onRefetchMemberships={() => {
          void membershipsQuery.refetch();
        }}
        allGroupsLoading={groupsLoading}
        allGroupsError={groupsError}
        onRefetchAllGroups={() => {
          void refetchGroups();
        }}
        availableGroups={availableGroups}
        filteredAvailableGroups={filteredAvailableGroups}
        groupFilterText={groupFilterText}
        onGroupFilterTextChange={setGroupFilterText}
        selectedGroupKeys={selectedGroupKeys}
        onToggleGroupSelection={handleToggleGroupSelection}
        onSelectAllFiltered={handleSelectAllFiltered}
        onClearSelection={handleClearSelection}
        visibleSelectedGroupsCount={visibleSelectedGroupsCount}
        hasHiddenSelectedGroups={hasHiddenSelectedGroups}
        selectedGroupsCount={selectedGroupKeys.size}
        addGroupPending={addGroupPending}
        onAddGroups={() => {
          void handleAddGroupsFromDetail();
        }}
        addGroupError={addGroupError}
        onRequestRemoveGroup={(group) => {
          setRemoveConfirmTarget(null);
          setRemoveError(null);
          setRemoveMembershipGroupTarget(group);
        }}
      />

      <Dialog
        open={removeConfirmTarget !== null || removeMembershipGroupTarget !== null}
        onOpenChange={(open) => {
          handleMutationDialogOpenChange(open, removePending, () => {
            setRemoveConfirmTarget(null);
            setRemoveMembershipGroupTarget(null);
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
              {removeConfirmTarget ? (
                <>
                  Are you sure you want to remove{" "}
                  <span className="font-semibold">{removeConfirmTarget.displayName}</span>
                  {removeConfirmTarget.primaryEmail && (
                    <span className="text-slate-500"> ({removeConfirmTarget.primaryEmail})</span>
                  )}
                  {" "}from this group?
                </>
              ) : removeMembershipGroupTarget && detailTarget ? (
                <>
                  Are you sure you want to remove{" "}
                  <span className="font-semibold">{detailTarget.displayName}</span>
                  {detailTarget.primaryEmail && (
                    <span className="text-slate-500"> ({detailTarget.primaryEmail})</span>
                  )}
                  {" "}from{" "}
                  <span className="font-semibold">{removeMembershipGroupTarget.displayName}</span>?
                </>
              ) : (
                "Remove this membership?"
              )}
            </DialogDescription>
          </DialogHeader>

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
              onClick={() => {
                setRemoveConfirmTarget(null);
                setRemoveMembershipGroupTarget(null);
                setRemoveError(null);
              }}
              disabled={removePending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                void (removeConfirmTarget ? handleRemoveMember() : handleRemoveMembershipGroup());
              }}
              disabled={removePending}
            >
              {removePending && <Loader2 className="size-3.5 mr-1 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
