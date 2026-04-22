import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import {
  Plus,
  Loader2,
  AlertCircle,
  WifiOff,
  Search,
  Info,
  CheckCircle2,
  ShieldAlert,
  UserMinus,
  UserPlus,
  AlertTriangle,
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
import { Badge } from "@/renderer/components/ui/badge";
import { Avatar, AvatarFallback } from "@/renderer/components/ui/avatar";
import { Input } from "@/renderer/components/ui/input";
import { Checkbox } from "@/renderer/components/ui/checkbox";
import { Alert, AlertTitle, AlertDescription } from "@/renderer/components/ui/alert";
import { Separator } from "@/renderer/components/ui/separator";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/renderer/components/ui/card";
import { ScrollArea } from "@/renderer/components/ui/scroll-area";
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
  AppShell,
  TableToolbar,
  FilterSegmentedControl,
  TableFilterButton,
} from "@/renderer/components/console";
import { useApp } from "@/renderer/components/console/app-context";
import {
  formatPresentedCommandFailure,
  presentCommandFailure,
} from "@/renderer/components/console/command-failure-presenter";
import {
  formatSourceDegradationNote,
  presentSourceDegradation,
} from "@/renderer/components/console/source-degradation-presenter";
import { useRecipientsSearchQuery } from "@/renderer/hooks/use-recipients-search";
import { useContactDetailsQuery } from "@/renderer/hooks/use-contact-details";
import { useGuestDetailsQuery } from "@/renderer/hooks/use-guest-details";
import { useExchangeRecipientDetailsQuery } from "@/renderer/hooks/use-exchange-recipient-details";
import {
  useCreateContactMutation,
  useUpdateContactCompanyMutation,
} from "@/renderer/hooks/use-contact-mutations";
import {
  useInviteGuestMutation,
  useUpdateGuestCompanyMutation,
} from "@/renderer/hooks/use-guest-mutations";
import {
  useExchangeGroupsQuery,
} from "@/renderer/hooks/use-exchange-groups";
import {
  useAddGroupMembersMutation,
  useRemoveGroupMembersMutation,
} from "@/renderer/hooks/use-group-member-mutations";
import {
  useGroupMembershipsQuery,
} from "@/renderer/hooks/use-group-memberships";
import { toGroupMemberSelectionRef } from "@/renderer/lib/group-member-selection";
import {
  getCombinedRecipientsConnectionIdentity,
  getExchangeConnectionIdentity,
  getGraphConnectionIdentity,
} from "@/renderer/lib/query-keys";
import {
  canDismissMutationDialog,
  handleMutationDialogOpenChange,
} from "@/renderer/components/console/mutation-dialog-guard";
import { cn } from "@/renderer/lib/utils";
import type {
  RecipientSearchItem,
  RecipientSearchType,
} from "@/shared/contracts/recipients";
import type {
  ExchangeGroupListItem,
  ExchangeGroupRef,
  GroupMemberSelectionRef,
  GroupsAddMembersResult,
  GroupsRemoveMembersResult,
} from "@/shared/contracts/exchange";
import type {
  ContactsCreateResult,
  ContactsUpdateCompanyResult,
  ContactDetails,
} from "@/shared/contracts/contacts";
import type {
  ExchangeRecipientDetails,
} from "@/shared/contracts/exchange";
import type {
  GuestsInviteResult,
  GuestsUpdateCompanyResult,
  GuestDetails,
} from "@/shared/contracts/guests";

type CreateMode = "contact" | "guest";

type CreateResult =
  | { mode: "contact"; data: ContactsCreateResult }
  | { mode: "guest"; data: GuestsInviteResult };

type DetailResult =
  | { mode: "contact"; data: ContactDetails }
  | { mode: "guest"; data: GuestDetails }
  | { mode: "exchangeRecipient"; data: ExchangeRecipientDetails };

type GroupAddBatchResult = {
  group: ExchangeGroupListItem;
  result: GroupsAddMembersResult;
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

function isAddStatusClean(status: GroupsAddMembersResult["items"][number]["status"]): boolean {
  return status === "added" || status === "alreadyMember";
}

function isRemoveStatusClean(status: GroupsRemoveMembersResult["items"][number]["status"]): boolean {
  return status === "removed" || status === "notMember";
}

const TAB_TYPES: Record<string, RecipientSearchType[]> = {
  all: [
    "mailbox",
    "mailContact",
    "mailUser",
    "distributionList",
    "mailEnabledSecurityGroup",
    "guestUser",
    "unknown",
  ],
  contacts: ["mailbox", "mailContact", "mailUser"],
  guests: ["guestUser"],
  groups: ["distributionList", "mailEnabledSecurityGroup"],
};

const TYPE_LABELS: Record<RecipientSearchType, string> = {
  mailbox: "MAILBOX",
  mailContact: "CONTACT",
  mailUser: "MAIL USER",
  guestMailUser: "GUEST MAIL USER",
  distributionList: "GROUP",
  mailEnabledSecurityGroup: "SECURITY GROUP",
  guestUser: "GUEST",
  unknown: "UNKNOWN",
};

const MEMBERSHIP_LABELS: Record<string, string> = {
  exchangeDirect: "Exchange Direct",
  graphBridgeable: "Graph Bridgeable",
  graphDeferred: "Graph Deferred",
  unsupported: "Unsupported",
};

const SOURCE_LABELS: Record<string, string> = {
  exchange: "Exchange",
  graph: "Graph",
};

const CONFLICT_CATEGORY_LABELS: Record<string, string> = {
  emailAlreadyOwned: "Email Already Owned",
  guestContactOverlap: "Guest/Contact Overlap",
  tenantMismatch: "Tenant Mismatch",
  eventualConsistencyDelay: "Eventual Consistency Delay",
  preflightUnavailable: "Preflight Unavailable",
};

const GROUP_KIND_LABELS: Record<ExchangeGroupListItem["groupKind"], string> = {
  distributionList: "Distribution",
  mailEnabledSecurityGroup: "Security",
};

function groupRefFromListItem(group: ExchangeGroupListItem): ExchangeGroupRef {
  return {
    exchangeIdentity: group.exchangeIdentity,
    objectId: group.objectId,
    groupKind: group.groupKind,
  };
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

function avatarColorFor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function typeBadgeClass(type: RecipientSearchType): string {
  switch (type) {
    case "mailbox":
    case "mailContact":
    case "mailUser":
      return "border border-teal-200 bg-teal-50 text-[11px] font-semibold text-[var(--color-primary)]";
    case "distributionList":
    case "mailEnabledSecurityGroup":
      return "border-transparent bg-[var(--color-primary)] text-white text-[11px] font-semibold";
    case "guestUser":
      return "border border-orange-200 bg-orange-50 text-[11px] font-semibold text-[var(--color-tertiary)]";
    default:
      return "border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500";
  }
}

function emailOrId(item: RecipientSearchItem): string {
  return item.primaryEmail ?? item.alias ?? item.exchangeIdentity ?? item.objectId ?? "\u2014";
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

function canInspect(item: RecipientSearchItem): boolean {
  return (
    item.recipientType === "mailContact" ||
    item.recipientType === "guestUser" ||
    item.recipientType === "mailbox" ||
    item.recipientType === "mailUser"
  );
}

function getUpdateMode(
  item: RecipientSearchItem,
): "contact" | "guest" {
  if (item.recipientType === "mailContact") return "contact";
  return "guest";
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-xs text-foreground truncate max-w-[60%]">{value}</span>
    </div>
  );
}

function ProfileHeader({ displayName, email, badgeClassName, badgeLabel, avatarKey }: {
  displayName: string;
  email: string;
  badgeClassName: string;
  badgeLabel: string;
  avatarKey: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/50 px-3 py-2.5">
      <Avatar className="size-8 text-xs">
        <AvatarFallback className={avatarColorFor(avatarKey)}>
          {getInitials(displayName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground truncate">{displayName}</p>
        <p className="text-[11px] text-muted-foreground truncate">{email}</p>
      </div>
      <Badge className={cn("shrink-0", badgeClassName)}>{badgeLabel}</Badge>
    </div>
  );
}

export function DirectoryScreen() {
  const { shell } = useApp();
  const exchangeConnected = shell.exchangeConnection?.state === "connected";
  const graphConnected = shell.graphConnection?.state === "connected";
  const graphTenantMatched = shell.graphConnection?.exchangeAlignment === "matched";
  const createContactMutation = useCreateContactMutation(
    shell.exchangeConnection,
    shell.graphConnection,
  );
  const updateContactCompanyMutation = useUpdateContactCompanyMutation(
    shell.exchangeConnection,
    shell.graphConnection,
  );
  const inviteGuestMutation = useInviteGuestMutation(shell.exchangeConnection, shell.graphConnection);
  const updateGuestCompanyMutation = useUpdateGuestCompanyMutation(
    shell.exchangeConnection,
    shell.graphConnection,
  );

  const [activeTab, setActiveTab] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [effectiveQuery, setEffectiveQuery] = useState("");

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>("contact");
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createCompanyName, setCreateCompanyName] = useState("");
  const [createSendInvitation, setCreateSendInvitation] = useState(true);
  const [createPending, setCreatePending] = useState(false);
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const [updateCompanyName, setUpdateCompanyName] = useState("");
  const [updatePending, setUpdatePending] = useState(false);
  const [updateResult, setUpdateResult] = useState<
    | { mode: "contact"; data: ContactsUpdateCompanyResult }
    | { mode: "guest"; data: GuestsUpdateCompanyResult }
    | null
  >(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<RecipientSearchItem | null>(null);

  const [recipientDialogTab, setRecipientDialogTab] = useState("details");

  const [removeGroupTarget, setRemoveGroupTarget] = useState<ExchangeGroupListItem | null>(null);
  const [removeGroupPending, setRemoveGroupPending] = useState(false);
  const [removeGroupResult, setRemoveGroupResult] = useState<GroupsRemoveMembersResult | null>(null);
  const [removeGroupError, setRemoveGroupError] = useState<string | null>(null);
  const [removedGroupName, setRemovedGroupName] = useState<string | null>(null);

  const [groupFilterText, setGroupFilterText] = useState("");
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<Set<string>>(new Set());
  const [addGroupPending, setAddGroupPending] = useState(false);
  const [addGroupResult, setAddGroupResult] = useState<GroupAddBatchResult[] | null>(null);
  const [addGroupError, setAddGroupError] = useState<string | null>(null);

  const canCreateContact = exchangeConnected;
  const canCreateGuest = graphConnected && graphTenantMatched;
  const canCreateAny = canCreateContact || canCreateGuest;

  useEffect(() => {
    const timer = setTimeout(() => {
      setEffectiveQuery(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const isGated = useMemo(() => {
    if (activeTab === "guests") {
      return !graphConnected || !graphTenantMatched;
    }
    return !exchangeConnected;
  }, [activeTab, exchangeConnected, graphConnected, graphTenantMatched]);

  const searchTypes = useMemo(() => TAB_TYPES[activeTab] ?? TAB_TYPES.all, [activeTab]);
  const exchangeConnectionIdentity = getExchangeConnectionIdentity(shell.exchangeConnection);
  const graphConnectionIdentity = getGraphConnectionIdentity(shell.graphConnection);
  const searchConnectionIdentity = useMemo(() => {
    if (activeTab === "guests") {
      return graphConnectionIdentity;
    }

    if (activeTab === "all") {
      return getCombinedRecipientsConnectionIdentity(shell.exchangeConnection, shell.graphConnection);
    }

    return exchangeConnectionIdentity;
  }, [activeTab, exchangeConnectionIdentity, graphConnectionIdentity]);

  const searchQuery = useRecipientsSearchQuery(
    searchConnectionIdentity,
    isGated ? "" : effectiveQuery,
    isGated ? [] : searchTypes,
    !isGated,
  );

  const results = searchQuery.results;
  const loading = searchQuery.isLoading;
  const error = searchQuery.error;

  const contactDetailsQuery = useContactDetailsQuery(
    shell.exchangeConnection,
    detailTarget?.recipientType === "mailContact" ? detailTarget.stableKey : undefined,
    detailDialogOpen && detailTarget?.recipientType === "mailContact",
  );

  const guestDetailsQuery = useGuestDetailsQuery(
    shell.graphConnection,
    detailTarget?.recipientType === "guestUser" ? detailTarget.stableKey : undefined,
    detailDialogOpen && detailTarget?.recipientType === "guestUser",
  );

  const exchangeRecipientDetailsQuery = useExchangeRecipientDetailsQuery(
    shell.exchangeConnection,
    detailTarget?.recipientType === "mailbox" || detailTarget?.recipientType === "mailUser"
      ? detailTarget.stableKey
      : undefined,
    detailDialogOpen &&
      (detailTarget?.recipientType === "mailbox" || detailTarget?.recipientType === "mailUser"),
  );

  const memberSelectionRef = useMemo((): GroupMemberSelectionRef | null => {
    if (!detailTarget) return null;
    return toGroupMemberSelectionRef(detailTarget);
  }, [detailTarget]);

  const membershipsQuery = useGroupMembershipsQuery(
    shell.exchangeConnection,
    memberSelectionRef,
    detailDialogOpen && !!memberSelectionRef,
  );

  const {
    groups: allGroups,
    isLoading: allGroupsLoading,
    error: allGroupsError,
    refetch: refetchAllGroups,
  } = useExchangeGroupsQuery(shell.exchangeConnection);

  const currentMemberRef = membershipsQuery.member;
  const currentMemberships = membershipsQuery.groups;

  const availableGroups = useMemo(() => {
    const currentMembershipKeys = new Set(
      currentMemberships.map((group) => group.exchangeIdentity),
    );

    return allGroups.filter(
      (group) => !currentMembershipKeys.has(group.exchangeIdentity),
    );
  }, [allGroups, currentMemberships]);

  const filteredAvailableGroups = useMemo(() => {
    const filter = groupFilterText.trim().toLowerCase();

    if (!filter) {
      return availableGroups;
    }

    return availableGroups.filter((group) => {
      const searchable = [
        group.displayName,
        group.exchangeIdentity,
        group.primaryEmail ?? "",
        group.alias ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(filter);
    });
  }, [availableGroups, groupFilterText]);

  const visibleSelectedGroupsCount = useMemo(
    () =>
      filteredAvailableGroups.filter((group) => selectedGroupKeys.has(group.exchangeIdentity)).length,
    [filteredAvailableGroups, selectedGroupKeys],
  );

  const hasHiddenSelectedGroups = selectedGroupKeys.size > visibleSelectedGroupsCount;

  const addGroupMembersMutation = useAddGroupMembersMutation(shell.exchangeConnection);
  const removeGroupMembersMutation = useRemoveGroupMembersMutation(shell.exchangeConnection);

  const activeDetailState = useMemo(() => {
    if (detailTarget?.recipientType === "mailContact") {
      return {
        pending: contactDetailsQuery.isLoading,
        error: contactDetailsQuery.error,
        result: contactDetailsQuery.contact
          ? ({ mode: "contact", data: contactDetailsQuery.contact } satisfies DetailResult)
          : null,
        refetch: contactDetailsQuery.refetch,
      };
    }

    if (detailTarget?.recipientType === "guestUser") {
      return {
        pending: guestDetailsQuery.isLoading,
        error: guestDetailsQuery.error,
        result: guestDetailsQuery.guest
          ? ({ mode: "guest", data: guestDetailsQuery.guest } satisfies DetailResult)
          : null,
        refetch: guestDetailsQuery.refetch,
      };
    }

    if (detailTarget?.recipientType === "mailbox" || detailTarget?.recipientType === "mailUser") {
      return {
        pending: exchangeRecipientDetailsQuery.isLoading,
        error: exchangeRecipientDetailsQuery.error,
        result: exchangeRecipientDetailsQuery.recipient
          ? ({ mode: "exchangeRecipient", data: exchangeRecipientDetailsQuery.recipient } satisfies DetailResult)
          : null,
        refetch: exchangeRecipientDetailsQuery.refetch,
      };
    }

    return {
      pending: false,
      error: null,
      result: null,
      refetch: async () => undefined,
    };
  }, [
    contactDetailsQuery.contact,
    contactDetailsQuery.error,
    contactDetailsQuery.isLoading,
    contactDetailsQuery.refetch,
    detailTarget?.recipientType,
    exchangeRecipientDetailsQuery.error,
    exchangeRecipientDetailsQuery.isLoading,
    exchangeRecipientDetailsQuery.recipient,
    exchangeRecipientDetailsQuery.refetch,
    guestDetailsQuery.error,
    guestDetailsQuery.guest,
    guestDetailsQuery.isLoading,
    guestDetailsQuery.refetch,
  ]);

  const detailPending = activeDetailState.pending;
  const detailError = activeDetailState.error;
  const detailResult = activeDetailState.result;

  const openCreateDialog = useCallback(() => {
    let mode: CreateMode = "contact";
    if (activeTab === "guests" && canCreateGuest) {
      mode = "guest";
    } else if (activeTab === "contacts" && canCreateContact) {
      mode = "contact";
    } else if (canCreateContact) {
      mode = "contact";
    } else if (canCreateGuest) {
      mode = "guest";
    }
    setCreateMode(mode);
    setCreateFirstName("");
    setCreateLastName("");
    setCreateEmail("");
    setCreateCompanyName("");
    setCreateSendInvitation(true);
    setCreatePending(false);
    setCreateResult(null);
    setCreateError(null);
    setCreateDialogOpen(true);
  }, [activeTab, canCreateContact, canCreateGuest]);

  const handleCreateSubmit = async () => {
    setCreatePending(true);
    setCreateError(null);
    try {
      if (createMode === "contact") {
        const result = await createContactMutation.mutateAsync({
          firstName: createFirstName.trim(),
          lastName: createLastName.trim(),
          email: createEmail.trim(),
          companyName: createCompanyName.trim(),
        });
        setCreateResult({ mode: "contact", data: result });
      } else {
        const payload: {
          email: string;
          displayName?: string;
          companyName?: string;
          sendInvitationMessage?: boolean;
        } = { email: createEmail.trim() };
        const displayNameTrimmed = createFirstName.trim();
        if (displayNameTrimmed) {
          payload.displayName = displayNameTrimmed;
        }
        const companyNameTrimmed = createCompanyName.trim();
        if (companyNameTrimmed) {
          payload.companyName = companyNameTrimmed;
        }
        payload.sendInvitationMessage = createSendInvitation;
        const result = await inviteGuestMutation.mutateAsync(payload);
        setCreateResult({ mode: "guest", data: result });
      }
    } catch (err: unknown) {
      setCreateError(
        formatPresentedCommandFailure(
          presentCommandFailure(err, "Create Error", "Operation failed."),
        ),
      );
    } finally {
      setCreatePending(false);
    }
  };

  const handleCreateClose = () => {
    if (createResult) {
      if (createResult.mode === "contact" && createResult.data.outcome === "created") {
        setActiveTab("contacts");
        const email = createResult.data.contact.primaryEmail;
        if (email) {
          setSearchText(email);
          setEffectiveQuery(email);
        }
      } else if (createResult.mode === "guest" && createResult.data.outcome === "invited") {
        setActiveTab("guests");
        const email = createResult.data.invitedUserEmail;
        if (email) {
          setSearchText(email);
          setEffectiveQuery(email);
        }
      }
    }
    setCreateDialogOpen(false);
    setCreateResult(null);
    setCreateError(null);
  };

  const handleUpdateSubmit = async () => {
    if (!detailTarget) return;
    setUpdatePending(true);
    setUpdateError(null);
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
      } else {
        const result = await updateGuestCompanyMutation.mutateAsync({
          payload: {
            guestUserId: detailTarget.objectId!,
            companyName: updateCompanyName.trim(),
          },
          stableKey: detailTarget.stableKey,
        });
        setUpdateResult({ mode: "guest", data: result });
      }
    } catch (err: unknown) {
      setUpdateError(
        formatPresentedCommandFailure(
          presentCommandFailure(err, "Update Error", "Operation failed."),
        ),
      );
    } finally {
      setUpdatePending(false);
    }
  };

  const handleUpdateClose = useCallback(() => {
    setUpdateResult(null);
    setUpdateError(null);
    setUpdatePending(false);
  }, []);

  const openRecipientDialog = useCallback((item: RecipientSearchItem) => {
    setDetailTarget(item);
    setDetailDialogOpen(true);
    setRecipientDialogTab("details");
    setUpdateCompanyName(item.companyName ?? "");
    setUpdatePending(false);
    setUpdateResult(null);
    setUpdateError(null);
    setGroupFilterText("");
    setSelectedGroupKeys(new Set());
    setAddGroupPending(false);
    setAddGroupResult(null);
    setAddGroupError(null);
    setRemoveGroupTarget(null);
    setRemoveGroupPending(false);
    setRemoveGroupResult(null);
    setRemoveGroupError(null);
    setRemovedGroupName(null);
  }, []);

  const handleDetailClose = useCallback(() => {
    handleUpdateClose();
    setDetailDialogOpen(false);
    setDetailTarget(null);
    setRecipientDialogTab("details");
    setUpdateCompanyName("");
    setGroupFilterText("");
    setSelectedGroupKeys(new Set());
    setAddGroupPending(false);
    setAddGroupResult(null);
    setAddGroupError(null);
    setRemoveGroupTarget(null);
    setRemoveGroupPending(false);
    setRemoveGroupResult(null);
    setRemoveGroupError(null);
    setRemovedGroupName(null);
  }, [handleUpdateClose]);

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

  const handleAddGroups = useCallback(async () => {
    if (!memberSelectionRef || visibleSelectedGroupsCount === 0) {
      return;
    }

    const groupsToAdd = filteredAvailableGroups.filter((group) =>
      selectedGroupKeys.has(group.exchangeIdentity),
    );

    if (groupsToAdd.length === 0) {
      return;
    }

    setAddGroupPending(true);
    setAddGroupError(null);
    setAddGroupResult(null);

    try {
      const batchResults: GroupAddBatchResult[] = [];

      for (const group of groupsToAdd) {
        const result = await addGroupMembersMutation.mutateAsync({
          groupRef: groupRefFromListItem(group),
          memberRefs: [memberSelectionRef],
        });

        batchResults.push({ group, result });
      }

      setAddGroupResult(batchResults);
      setSelectedGroupKeys(new Set());
      await membershipsQuery.refetch();
    } catch (err: unknown) {
      setAddGroupError(
        formatPresentedCommandFailure(
          presentCommandFailure(err, "Add to Groups Error", "Failed to add to selected groups."),
        ),
      );
    } finally {
      setAddGroupPending(false);
    }
  }, [
    addGroupMembersMutation,
    filteredAvailableGroups,
    memberSelectionRef,
    membershipsQuery,
    selectedGroupKeys,
    visibleSelectedGroupsCount,
  ]);

  const handleRemoveGroup = useCallback(async () => {
    if (!removeGroupTarget || !currentMemberRef) {
      return;
    }

    setRemoveGroupPending(true);
    setRemoveGroupError(null);
    setRemoveGroupResult(null);

    try {
      const result = await removeGroupMembersMutation.mutateAsync({
        groupRef: groupRefFromListItem(removeGroupTarget),
        memberRefs: [currentMemberRef],
      });

      setRemoveGroupResult(result);
      setRemovedGroupName(removeGroupTarget.displayName);
      setRemoveGroupTarget(null);
      await membershipsQuery.refetch();
    } catch (err: unknown) {
      setRemoveGroupError(
        formatPresentedCommandFailure(
          presentCommandFailure(err, "Remove From Group Error", "Failed to remove from group."),
        ),
      );
    } finally {
      setRemoveGroupPending(false);
    }
  }, [currentMemberRef, membershipsQuery, removeGroupMembersMutation, removeGroupTarget]);

  const tabs = [
    { label: "All", value: "all" },
    { label: "Contacts", value: "contacts" },
    { label: "Guests", value: "guests" },
    { label: "Groups", value: "groups" },
  ];

  const gateTitle =
    activeTab === "guests"
      ? graphConnected
        ? "Tenant Alignment Required"
        : "Graph Not Connected"
      : "Exchange Not Connected";

  const gateMessage =
    activeTab === "guests"
      ? graphConnected
        ? "Microsoft Graph is connected, but the tenant does not match the current Exchange session. Reconnect with a matching tenant to search guest users."
        : "Connect to Microsoft Graph with a matching tenant to search for guest users."
      : "Connect to Exchange Online to search the directory.";

  const degradationNote = results
    ? presentSourceDegradation(results.sourceStatus, results.sourceFailures)
    : null;

  const createFormValid =
    createMode === "contact"
      ? createFirstName.trim().length > 0 &&
        createLastName.trim().length > 0 &&
        createEmail.trim().length > 0 &&
        createCompanyName.trim().length > 0
      : createEmail.trim().length > 0;

  const detailCanUpdateCompany = detailTarget
    ? canUpdateCompany(
        detailTarget,
        exchangeConnected,
        graphConnected,
        graphTenantMatched,
      )
    : false;

  const selectedGroupsCount = selectedGroupKeys.size;
  const recipientDialogPending = addGroupPending || updatePending;
  const addGroupIssues = addGroupResult?.flatMap(({ group, result }) =>
    result.items
      .filter((item) => !isAddStatusClean(item.status))
      .map((item) => ({ groupName: group.displayName, status: item.status, detail: item.detail })),
  ) ?? [];
  const addGroupHadIssues = addGroupIssues.length > 0;
  const removeGroupStatus = removeGroupResult?.items[0]?.status ?? null;
  const removeGroupHadIssues = removeGroupStatus !== null && !isRemoveStatusClean(removeGroupStatus);

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
                Manage users, cross-functional groups, and external guests in a
                high-density operational view.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-semibold"
                disabled
              >
                Export Registry
              </Button>
              <Button
                size="sm"
                className="text-xs font-semibold"
                disabled={!canCreateAny}
                onClick={openCreateDialog}
              >
                <Plus className="size-3 mr-1" />
                Create Identity
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[var(--color-outline-variant)]/20 overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
            <TableToolbar
              searchPlaceholder="Search by name, email, or handle"
              onSearch={setSearchText}
              filters={
                <>
                  <FilterSegmentedControl
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                  />
                  <TableFilterButton label="Filters" className="pointer-events-none opacity-50" />
                </>
              }
            />

            {isGated ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center py-16 px-8">
                  <WifiOff className="size-10 text-slate-300 mx-auto mb-4" />
                  <h2 className="text-lg font-bold font-headline text-slate-700 mb-2">
                    {gateTitle}
                  </h2>
                  <p className="text-sm text-slate-500 max-w-sm">
                    {gateMessage}
                  </p>
                </div>
              </div>
            ) : loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center py-16 px-8">
                  <Loader2 className="size-8 text-[var(--color-primary)] mx-auto mb-4 animate-spin" />
                  <p className="text-sm text-slate-500">
                    Searching directory\u2026
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center py-16 px-8">
                  <AlertCircle className="size-10 text-[var(--color-error)] mx-auto mb-4" />
                  <h2 className="text-lg font-bold font-headline text-slate-700 mb-2">
                    Search Failed
                  </h2>
                  <p className="text-sm text-slate-500 max-w-sm mb-4">
                    {error}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEffectiveQuery("");
                      setSearchText("");
                    }}
                  >
                    Clear Search
                  </Button>
                </div>
              </div>
            ) : effectiveQuery.trim().length < 2 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center py-16 px-8">
                  <Search className="size-10 text-slate-300 mx-auto mb-4" />
                  <h2 className="text-lg font-bold font-headline text-slate-700 mb-2">
                    Search the Directory
                  </h2>
                  <p className="text-sm text-slate-500 max-w-sm">
                    Type at least 2 characters to search for recipients by name,
                    email, or handle.
                  </p>
                </div>
              </div>
            ) : results && results.items.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center py-16 px-8">
                  <Search className="size-10 text-slate-300 mx-auto mb-4" />
                  <h2 className="text-lg font-bold font-headline text-slate-700 mb-2">
                    No Results
                  </h2>
                  <p className="text-sm text-slate-500 max-w-sm">
                    No recipients matched &ldquo;{effectiveQuery.trim()}&rdquo;.
                    Try a different search term or change the filter tab.
                  </p>
                  {degradationNote && (
                    <p className="mt-3 text-xs text-amber-700">
                      Partial results only &mdash; {formatSourceDegradationNote(degradationNote)}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                {degradationNote && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
                    <Info className="size-3.5 shrink-0" />
                    <span>
                      Partial results &mdash; {formatSourceDegradationNote(degradationNote)}
                    </span>
                  </div>
                )}
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results?.items.map((item) => {
                        const inspectable = canInspect(item);
                        return (
                          <TableRow
                            key={item.stableKey}
                            className={cn(
                              "transition-colors",
                              inspectable
                                ? "cursor-pointer hover:bg-teal-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]/40"
                                : "hover:bg-slate-50/30",
                            )}
                            tabIndex={inspectable ? 0 : undefined}
                            role={inspectable ? "button" : undefined}
                            onClick={inspectable ? () => openRecipientDialog(item) : undefined}
                            onKeyDown={inspectable
                              ? (e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    openRecipientDialog(item);
                                  }
                                }
                              : undefined}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="w-6 h-6 text-[10px]">
                                  <AvatarFallback
                                    className={avatarColorFor(item.stableKey)}
                                  >
                                    {getInitials(item.displayName)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-semibold text-[var(--color-foreground)]">
                                  {item.displayName}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-slate-700 font-medium">
                              {emailOrId(item)}
                            </TableCell>
                            <TableCell className="text-sm text-slate-500">
                              {item.companyName ?? "\u2014"}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={typeBadgeClass(item.recipientType)}>
                                {TYPE_LABELS[item.recipientType]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {SOURCE_LABELS[item.source] ?? item.source}
                            </TableCell>
                            <TableCell className="text-sm text-slate-500">
                              {MEMBERSHIP_LABELS[item.membershipSupport] ??
                                item.membershipSupport}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          handleMutationDialogOpenChange(open, createPending, handleCreateClose);
        }}
      >
        <DialogContent
          className="sm:max-w-lg max-h-[85vh] flex flex-col"
          showCloseButton={canDismissMutationDialog(createPending)}
        >
          <DialogHeader>
            <DialogTitle>
              {createResult && createResult.data.outcome === "blockedConflict"
                ? "Creation Blocked"
                : "Create Identity"}
            </DialogTitle>
            <DialogDescription>
              {createResult
                ? createResult.data.outcome === "blockedConflict"
                  ? "This identity could not be created due to a blocking conflict."
                  : "Identity created successfully."
                : "Create a new contact or invite a guest user to the directory."}
            </DialogDescription>
          </DialogHeader>

          {createResult ? (
            <div className="flex-1 overflow-y-auto space-y-2 py-2">
              {createResult.data.outcome === "blockedConflict" ? (
                <>
                  <Alert variant="destructive">
                    <ShieldAlert className="size-4" />
                    <AlertTitle className="flex items-center gap-2">
                      <Badge className="border border-red-200 bg-red-50 text-[11px] font-semibold text-red-700">
                        {CONFLICT_CATEGORY_LABELS[createResult.data.conflict.category] ??
                          createResult.data.conflict.category}
                      </Badge>
                    </AlertTitle>
                    <AlertDescription>
                      {createResult.data.conflict.message}
                    </AlertDescription>
                  </Alert>
                  <div className="text-xs text-slate-600 bg-amber-50 rounded-md px-3 py-2">
                    <span className="font-semibold">Guidance:</span>{" "}
                    {createResult.data.conflict.guidance}
                  </div>
                  <div className="text-xs text-slate-500">
                    Target:{" "}
                    <span className="font-medium text-slate-700">
                      {createResult.data.conflict.targetEmail}
                    </span>
                  </div>
                  {createResult.data.conflict.records.length > 0 && (
                    <>
                      <Separator />
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Conflicting Records
                      </p>
                      <div className="space-y-2">
                        {createResult.data.conflict.records.map((record) => (
                          <div
                            key={`${record.displayName}-${record.source}`}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-md text-xs"
                          >
                            <Avatar className="w-6 h-6 text-[10px]">
                              <AvatarFallback className={avatarColorFor(record.displayName)}>
                                {getInitials(record.displayName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-slate-800 truncate">
                                {record.displayName}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">
                                {record.primaryEmail ??
                                  record.userPrincipalName ??
                                  record.exchangeIdentity ??
                                  "\u2014"}
                              </p>
                            </div>
                            <Badge
                              className={cn(
                                "shrink-0",
                                typeBadgeClass(record.recipientType),
                              )}
                            >
                              {TYPE_LABELS[record.recipientType]}
                            </Badge>
                            <span className="text-[11px] text-slate-400 shrink-0">
                              {SOURCE_LABELS[record.source] ?? record.source}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : createResult.mode === "contact" ? (
                <>
                  <div className="flex items-start gap-2 rounded-md px-3 py-2 text-xs bg-emerald-50 text-emerald-800">
                    <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600" />
                    <div className="min-w-0">
                      <p className="font-semibold">{createResult.data.contact.displayName}</p>
                      <p className="text-[11px] opacity-80">
                        {createResult.data.contact.primaryEmail ?? "\u2014"}
                      </p>
                      {createResult.data.contact.companyName && (
                        <p className="text-[11px] opacity-80">
                          Company: {createResult.data.contact.companyName}
                        </p>
                      )}
                    </div>
                  </div>
                  {createResult.data.verification && (
                    <div className="text-[11px] text-slate-500 pt-1">
                      Verification: {createResult.data.verification.detail}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2 rounded-md px-3 py-2 text-xs bg-emerald-50 text-emerald-800">
                    <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600" />
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {createResult.data.invitedUserDisplayName ?? createResult.data.invitedUserEmail}
                      </p>
                      <p className="text-[11px] opacity-80">
                        {createResult.data.invitedUserEmail}
                      </p>
                      <p className="text-[11px] opacity-80">
                        Status: {createResult.data.status}
                      </p>
                    </div>
                  </div>
                  {createResult.data.companyUpdate && (
                    <div className="text-[11px] text-slate-500">
                      Company update: {createResult.data.companyUpdate.detail}
                    </div>
                  )}
                  {createResult.data.verification && (
                    <div className="text-[11px] text-slate-500">
                      Verification: {createResult.data.verification.detail}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Button
                  variant={createMode === "contact" ? "default" : "outline"}
                  size="sm"
                  className="text-xs flex-1"
                  disabled={!canCreateContact}
                  onClick={() => {
                    setCreateMode("contact");
                    setCreateResult(null);
                    setCreateError(null);
                  }}
                >
                  Contact
                </Button>
                <Button
                  variant={createMode === "guest" ? "default" : "outline"}
                  size="sm"
                  className="text-xs flex-1"
                  disabled={!canCreateGuest}
                  onClick={() => {
                    setCreateMode("guest");
                    setCreateResult(null);
                    setCreateError(null);
                  }}
                >
                  Guest
                </Button>
              </div>

              {createMode === "contact" ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1 block">
                        First Name <span className="text-[var(--color-error)]">*</span>
                      </label>
                      <Input
                        className="bg-slate-50 border-slate-200 text-xs"
                        placeholder="First name"
                        value={createFirstName}
                        onChange={(e) => setCreateFirstName(e.target.value)}
                        disabled={createPending}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1 block">
                        Last Name <span className="text-[var(--color-error)]">*</span>
                      </label>
                      <Input
                        className="bg-slate-50 border-slate-200 text-xs"
                        placeholder="Last name"
                        value={createLastName}
                        onChange={(e) => setCreateLastName(e.target.value)}
                        disabled={createPending}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1 block">
                      Email <span className="text-[var(--color-error)]">*</span>
                    </label>
                    <Input
                      className="bg-slate-50 border-slate-200 text-xs"
                      placeholder="email@example.com"
                      type="email"
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      disabled={createPending}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1 block">
                      Company Name <span className="text-[var(--color-error)]">*</span>
                    </label>
                    <Input
                      className="bg-slate-50 border-slate-200 text-xs"
                      placeholder="Company name"
                      value={createCompanyName}
                      onChange={(e) => setCreateCompanyName(e.target.value)}
                      disabled={createPending}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1 block">
                      Email <span className="text-[var(--color-error)]">*</span>
                    </label>
                    <Input
                      className="bg-slate-50 border-slate-200 text-xs"
                      placeholder="guest@example.com"
                      type="email"
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      disabled={createPending}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1 block">
                      Display Name
                    </label>
                    <Input
                      className="bg-slate-50 border-slate-200 text-xs"
                      placeholder="Optional display name"
                      value={createFirstName}
                      onChange={(e) => setCreateFirstName(e.target.value)}
                      disabled={createPending}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1 block">
                      Company Name
                    </label>
                    <Input
                      className="bg-slate-50 border-slate-200 text-xs"
                      placeholder="Optional company name"
                      value={createCompanyName}
                      onChange={(e) => setCreateCompanyName(e.target.value)}
                      disabled={createPending}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="send-invitation"
                      checked={createSendInvitation}
                      onCheckedChange={(checked) => setCreateSendInvitation(checked === true)}
                      disabled={createPending}
                    />
                    <label htmlFor="send-invitation" className="text-xs text-slate-600 cursor-pointer">
                      Send invitation message
                    </label>
                  </div>
                </div>
              )}
            </>
          )}

          {createError && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-error)] bg-red-50 rounded-md px-3 py-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          <DialogFooter>
            {createResult ? (
              <Button size="sm" onClick={handleCreateClose}>
                Close
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={handleCreateClose} disabled={createPending}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!createFormValid || createPending}
                  onClick={() => { void handleCreateSubmit(); }}
                >
                  {createPending && <Loader2 className="size-3.5 mr-1 animate-spin" />}
                  {createMode === "contact" ? "Create Contact" : "Invite Guest"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailDialogOpen}
        onOpenChange={(open) => {
          if (!open && canDismissMutationDialog(recipientDialogPending)) {
            handleDetailClose();
          }
        }}
      >
        <DialogContent
          className="sm:max-w-3xl max-h-[85vh] flex flex-col"
          showCloseButton={canDismissMutationDialog(recipientDialogPending)}
        >
          <DialogHeader>
            <DialogTitle>
              {detailTarget
                ? detailTarget.recipientType === "mailContact"
                  ? "Contact Details"
                  : detailTarget.recipientType === "guestUser"
                    ? "Guest Details"
                    : detailTarget.recipientType === "mailbox"
                      ? "Mailbox Details"
                      : "Mail User Details"
                : "Details"}
            </DialogTitle>
            <DialogDescription>
              {detailTarget
                ? `Inspecting ${detailTarget.displayName}`
                : "Viewing directory entry details."}
            </DialogDescription>
          </DialogHeader>

          {detailTarget && (
            <Tabs value={recipientDialogTab} onValueChange={setRecipientDialogTab} className="flex min-h-0 flex-1 flex-col">
              <Separator className="-mx-4 mb-2" />
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="groups">Groups</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="mt-4 flex-1 min-h-0">
                <ScrollArea className="h-full">
                  <div className="flex flex-col gap-4 p-2">
          {detailPending ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="size-8 text-[var(--color-primary)] mx-auto mb-4 animate-spin" />
                <p className="text-sm text-muted-foreground">Loading details\u2026</p>
              </div>
            </div>
          ) : detailError ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <AlertCircle className="size-10 text-[var(--color-error)] mx-auto mb-4" />
                <h2 className="text-lg font-bold font-headline text-foreground mb-2">
                  Failed to Load Details
                </h2>
                <p className="text-sm text-muted-foreground max-w-sm mb-4">
                  {detailError}
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    void activeDetailState.refetch();
                  }}
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : detailResult ? (
            <>
              {detailCanUpdateCompany && (
                <Card className="bg-muted/30 border-border/50">
                  <CardHeader className="p-4 pb-2 space-y-1">
                    <CardTitle className="text-sm">Company name</CardTitle>
                    <CardDescription className="text-xs">
                      Update the company value directly from this dialog.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <div className="flex gap-2">
                      <Input
                        className="bg-background text-xs"
                        value={updateCompanyName}
                        onChange={(e) => setUpdateCompanyName(e.target.value)}
                        disabled={updatePending}
                        placeholder="Enter company name"
                      />
                      <Button
                        size="sm"
                        disabled={updatePending || updateCompanyName.trim().length === 0}
                        onClick={() => {
                          void handleUpdateSubmit();
                        }}
                      >
                        {updatePending && <Loader2 className="mr-1 size-3.5 animate-spin" />}
                        Save
                      </Button>
                    </div>
                    {updateResult && (
                      <p className="mt-2 text-xs text-emerald-700">
                        {updateResult.data.verification.detail}
                      </p>
                    )}
                    {updateError && (
                      <p className="mt-2 text-xs text-[var(--color-error)]">{updateError}</p>
                    )}
                  </CardContent>
                </Card>
              )}
              {detailResult.mode === "contact" ? (
                <>
                  <ProfileHeader
                    displayName={detailResult.data.displayName}
                    email={detailResult.data.primaryEmail ?? detailResult.data.alias ?? "\u2014"}
                    badgeClassName={typeBadgeClass("mailContact")}
                   badgeLabel="CONTACT"
                   avatarKey={detailTarget?.stableKey ?? ""}
                 />
                 <div className="divide-y divide-slate-100 rounded-lg border border-border/50 px-4 py-1">
                    {detailResult.data.primaryEmail && (
                      <DetailRow label="Email" value={detailResult.data.primaryEmail} />
                    )}
                    {detailResult.data.alias && (
                      <DetailRow label="Alias" value={detailResult.data.alias} />
                    )}
                    {detailResult.data.companyName && (
                      <DetailRow label="Company" value={detailResult.data.companyName} />
                    )}
                    {detailResult.data.firstName && (
                      <DetailRow label="First Name" value={detailResult.data.firstName} />
                    )}
                    {detailResult.data.lastName && (
                      <DetailRow label="Last Name" value={detailResult.data.lastName} />
                    )}
                    {detailResult.data.title && (
                      <DetailRow label="Title" value={detailResult.data.title} />
                    )}
                    {detailResult.data.department && (
                      <DetailRow label="Department" value={detailResult.data.department} />
                    )}
                    {detailResult.data.phone && (
                      <DetailRow label="Phone" value={detailResult.data.phone} />
                    )}
                    {detailResult.data.office && (
                      <DetailRow label="Office" value={detailResult.data.office} />
                    )}
                    {detailResult.data.streetAddress && (
                      <DetailRow label="Street Address" value={detailResult.data.streetAddress} />
                    )}
                    {detailResult.data.city && (
                      <DetailRow label="City" value={detailResult.data.city} />
                    )}
                    {detailResult.data.stateOrProvince && (
                      <DetailRow label="State/Province" value={detailResult.data.stateOrProvince} />
                    )}
                    {detailResult.data.postalCode && (
                      <DetailRow label="Postal Code" value={detailResult.data.postalCode} />
                    )}
                    {detailResult.data.countryOrRegion && (
                      <DetailRow label="Country/Region" value={detailResult.data.countryOrRegion} />
                    )}
                  </div>
                </>
              ) : detailResult.mode === "guest" ? (
                <>
                  <ProfileHeader
                    displayName={detailResult.data.displayName ?? "\u2014"}
                    email={detailResult.data.primaryEmail ?? detailResult.data.userPrincipalName ?? "\u2014"}
                    badgeClassName={typeBadgeClass("guestUser")}
                   badgeLabel="GUEST"
                   avatarKey={detailTarget?.stableKey ?? ""}
                 />
                 <div className="divide-y divide-slate-100 rounded-lg border border-border/50 px-4 py-1">
                    {detailResult.data.primaryEmail && (
                      <DetailRow label="Email" value={detailResult.data.primaryEmail} />
                    )}
                    {detailResult.data.userPrincipalName && (
                      <DetailRow label="UPN" value={detailResult.data.userPrincipalName} />
                    )}
                    {detailResult.data.companyName && (
                      <DetailRow label="Company" value={detailResult.data.companyName} />
                    )}
                    {detailResult.data.givenName && (
                      <DetailRow label="First Name" value={detailResult.data.givenName} />
                    )}
                    {detailResult.data.surname && (
                      <DetailRow label="Last Name" value={detailResult.data.surname} />
                    )}
                    {detailResult.data.jobTitle && (
                      <DetailRow label="Job Title" value={detailResult.data.jobTitle} />
                    )}
                    {detailResult.data.department && (
                      <DetailRow label="Department" value={detailResult.data.department} />
                    )}
                    {detailResult.data.mobilePhone && (
                      <DetailRow label="Mobile Phone" value={detailResult.data.mobilePhone} />
                    )}
                    {detailResult.data.officeLocation && (
                      <DetailRow label="Office Location" value={detailResult.data.officeLocation} />
                    )}
                    {detailResult.data.preferredLanguage && (
                      <DetailRow label="Preferred Language" value={detailResult.data.preferredLanguage} />
                    )}
                    <DetailRow
                      label="Status"
                      value={
                        <span className={cn(
                          "text-xs font-medium",
                          detailResult.data.externalUserState === "Accepted"
                            ? "text-emerald-700"
                            : detailResult.data.externalUserState === "PendingAcceptance"
                              ? "text-amber-700"
                              : "text-muted-foreground",
                        )}>
                          {detailResult.data.externalUserState === "Accepted"
                            ? "Accepted"
                            : detailResult.data.externalUserState === "PendingAcceptance"
                              ? "Pending Acceptance"
                              : "Unknown"}
                        </span>
                      }
                    />
                    {detailResult.data.accountEnabled !== null && (
                      <DetailRow
                        label="Account Enabled"
                        value={
                          <span className={cn(
                            "text-xs font-medium",
                            detailResult.data.accountEnabled ? "text-emerald-700" : "text-red-600",
                          )}>
                            {detailResult.data.accountEnabled ? "Yes" : "No"}
                          </span>
                        }
                      />
                    )}
                    {detailResult.data.createdDateTime && (
                      <DetailRow
                        label="Created"
                        value={new Date(detailResult.data.createdDateTime).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      />
                    )}
                  </div>
                </>
              ) : (
                <>
                  <ProfileHeader
                    displayName={detailResult.data.displayName}
                    email={detailResult.data.primaryEmail ?? detailResult.data.alias ?? "\u2014"}
                    badgeClassName={typeBadgeClass(detailResult.data.recipientType)}
                   badgeLabel={TYPE_LABELS[detailResult.data.recipientType]}
                   avatarKey={detailTarget?.stableKey ?? ""}
                 />
                 <div className="divide-y divide-slate-100 rounded-lg border border-border/50 px-4 py-1">
                    {detailResult.data.primaryEmail && (
                      <DetailRow label="Email" value={detailResult.data.primaryEmail} />
                    )}
                    {detailResult.data.alias && (
                      <DetailRow label="Alias" value={detailResult.data.alias} />
                    )}
                    {detailResult.data.userPrincipalName && (
                      <DetailRow label="UPN" value={detailResult.data.userPrincipalName} />
                    )}
                    {detailResult.data.externalEmailAddress && (
                      <DetailRow label="External Target" value={detailResult.data.externalEmailAddress} />
                    )}
                    {detailResult.data.companyName && (
                      <DetailRow label="Company" value={detailResult.data.companyName} />
                    )}
                    {detailResult.data.firstName && (
                      <DetailRow label="First Name" value={detailResult.data.firstName} />
                    )}
                    {detailResult.data.lastName && (
                      <DetailRow label="Last Name" value={detailResult.data.lastName} />
                    )}
                    {detailResult.data.title && (
                      <DetailRow label="Title" value={detailResult.data.title} />
                    )}
                    {detailResult.data.department && (
                      <DetailRow label="Department" value={detailResult.data.department} />
                    )}
                    {detailResult.data.phone && (
                      <DetailRow label="Phone" value={detailResult.data.phone} />
                    )}
                    {detailResult.data.office && (
                      <DetailRow label="Office" value={detailResult.data.office} />
                    )}
                    {detailResult.data.recipientTypeDetails && (
                      <DetailRow label="Type Details" value={detailResult.data.recipientTypeDetails} />
                    )}
                  </div>
                </>
              )}
            </>
          ) : null}
                  </div>
                </ScrollArea>
              </TabsContent>

<TabsContent value="groups" className="mt-4 flex-1 min-h-0">
                <ScrollArea className="h-full">
                  <div className="flex flex-col gap-4 p-2">
                  {membershipsQuery.error && (
                    <Alert variant="destructive">
                      <AlertCircle className="size-4" />
                      <AlertTitle>Failed to load memberships</AlertTitle>
                      <AlertDescription>
                        <div className="flex flex-col gap-3">
                          <span>{membershipsQuery.error}</span>
                          <div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                void membershipsQuery.refetch();
                              }}
                            >
                              Retry memberships
                            </Button>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {removeGroupResult && (
                    removeGroupHadIssues ? (
                      <Alert variant="destructive">
                        <AlertCircle className="size-4" />
                        <AlertTitle>Remove from group needs attention</AlertTitle>
                        <AlertDescription>
                          {REMOVE_STATUS_LABELS[removeGroupStatus ?? "failed"]}: {removeGroupResult.items[0]?.detail ?? "Membership update failed."}
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="flex items-start gap-2 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                        <span>
                          {REMOVE_STATUS_LABELS[removeGroupStatus ?? "removed"]} — <span className="font-semibold">{removedGroupName ?? "group"}</span>.
                        </span>
                      </div>
                    )
                  )}

                  {addGroupResult && addGroupResult.length > 0 && (
                    addGroupHadIssues ? (
                      <Alert variant="destructive">
                        <AlertCircle className="size-4" />
                        <AlertTitle>Some group updates need attention</AlertTitle>
                        <AlertDescription>
                          <div className="flex flex-col gap-1">
                            {addGroupIssues.map((issue) => (
                              <span key={`${issue.groupName}:${issue.status}:${issue.detail}`}>
                                <span className="font-semibold">{issue.groupName}</span>: {ADD_STATUS_LABELS[issue.status]} — {issue.detail}
                              </span>
                            ))}
                          </div>
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="flex items-start gap-2 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                        <div className="flex flex-col gap-1">
                          {addGroupResult.map(({ group, result }) => {
                            const status = result.items[0]?.status ?? "failed";
                            return (
                              <span key={group.exchangeIdentity}>
                                <span className="font-semibold">{group.displayName}</span>: {ADD_STATUS_LABELS[status]}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )
                  )}

                  {addGroupError && (
                    <p className="text-xs text-[var(--color-error)]">{addGroupError}</p>
                  )}

                  {!memberSelectionRef ? (
                    <Alert>
                      <AlertTriangle className="size-4" />
                      <AlertTitle>Membership unavailable</AlertTitle>
                      <AlertDescription>
                        This directory entry cannot be resolved into a membership target.
                      </AlertDescription>
                    </Alert>
                  ) : membershipsQuery.isLoading || allGroupsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="size-8 animate-spin text-[var(--color-primary)]" />
                    </div>
                  ) : membershipsQuery.error ? null : (
                    <>
                      <Card className="border-border/50">
                        <CardHeader className="p-4 pb-3 space-y-1">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <CardTitle className="text-sm">Current groups</CardTitle>
                              <CardDescription className="text-xs">
                                Review memberships and remove this person from a group.
                              </CardDescription>
                            </div>
                            <Badge variant="secondary">{currentMemberships.length}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          {currentMemberships.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              This person is not currently in any groups.
                            </p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {currentMemberships.map((group) => (
                                <div
                                  key={group.exchangeIdentity}
                                  className="flex items-center gap-3 rounded-md border border-border/50 px-3 py-2"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-foreground">
                                      {group.displayName}
                                    </p>
                                    <p className="truncate text-[11px] text-muted-foreground">
                                      {group.primaryEmail ?? group.exchangeIdentity}
                                    </p>
                                  </div>
                                  <Badge variant="outline">{GROUP_KIND_LABELS[group.groupKind]}</Badge>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setRemoveGroupError(null);
                                      setRemoveGroupResult(null);
                                      setRemoveGroupTarget(group);
                                    }}
                                  >
                                    <UserMinus className="mr-1 size-3.5" />
                                    Remove
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {allGroupsError ? (
                        <Alert variant="destructive">
                          <AlertCircle className="size-4" />
                          <AlertTitle>Failed to load available groups</AlertTitle>
                          <AlertDescription>
                            <div className="flex flex-col gap-3">
                              <span>{allGroupsError}</span>
                              <div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    void refetchAllGroups();
                                  }}
                                >
                                  Retry groups list
                                </Button>
                              </div>
                            </div>
                          </AlertDescription>
                        </Alert>
                      ) : (
                      <Card className="border-border/50">
                        <CardHeader className="p-4 pb-3 space-y-1">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <CardTitle className="text-sm">Add to groups</CardTitle>
                              <CardDescription className="text-xs">
                                Select multiple groups and add this person in one pass.
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              {selectedGroupsCount > 0 && (
                                <span className="text-xs font-medium text-[var(--color-primary)]">
                                  {visibleSelectedGroupsCount}/{selectedGroupsCount} visible selected
                                </span>
                              )}
                              <Badge variant="secondary">
                                {groupFilterText.trim()
                                  ? `${filteredAvailableGroups.length}/${availableGroups.length}`
                                  : availableGroups.length}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <div className="flex flex-col gap-3">
                            <div className="flex gap-2">
                              <Input
                                className="text-xs"
                                placeholder="Filter available groups..."
                                value={groupFilterText}
                                onChange={(e) => setGroupFilterText(e.target.value)}
                                disabled={addGroupPending}
                              />
                              <Button
                                size="sm"
                                disabled={visibleSelectedGroupsCount === 0 || addGroupPending}
                                onClick={() => {
                                  void handleAddGroups();
                                }}
                              >
                                {addGroupPending ? (
                                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                                ) : (
                                  <UserPlus className="mr-1 size-3.5" />
                                )}
                                Add selected ({visibleSelectedGroupsCount})
                              </Button>
                            </div>

                            {(filteredAvailableGroups.length > 0 || selectedGroupsCount > 0) && (
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    disabled={addGroupPending || filteredAvailableGroups.every((g) => selectedGroupKeys.has(g.exchangeIdentity))}
                                    onClick={() => {
                                      setSelectedGroupKeys((prev) => {
                                        const next = new Set(prev);
                                        for (const g of filteredAvailableGroups) {
                                          next.add(g.exchangeIdentity);
                                        }
                                        return next;
                                      });
                                    }}
                                  >
                                    Select all filtered
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    disabled={addGroupPending || selectedGroupsCount === 0}
                                    onClick={() => setSelectedGroupKeys(new Set())}
                                  >
                                    Clear selection
                                  </Button>
                                </div>
                                <span className="text-muted-foreground">
                                  {visibleSelectedGroupsCount} of {filteredAvailableGroups.length} shown
                                  {hasHiddenSelectedGroups ? ` \u2022 ${selectedGroupsCount - visibleSelectedGroupsCount} hidden by filter` : ""}
                                </span>
                              </div>
                            )}

                            {availableGroups.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                There are no additional groups available to add.
                              </p>
                            ) : filteredAvailableGroups.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                No additional groups match the current filter.
                                {hasHiddenSelectedGroups ? " Clear the filter to review hidden selections." : ""}
                              </p>
                            ) : (
                              <div className="max-h-64 overflow-y-auto rounded-md border border-border/50">
                                {filteredAvailableGroups.map((group) => (
                                  <label
                                    key={group.exchangeIdentity}
                                    className={cn(
                                      "flex cursor-pointer items-center gap-3 border-b border-border/30 px-3 py-2 last:border-b-0 transition-colors",
                                      selectedGroupKeys.has(group.exchangeIdentity)
                                        ? "bg-primary/5"
                                        : "hover:bg-muted/50",
                                    )}
                                  >
                                    <Checkbox
                                      checked={selectedGroupKeys.has(group.exchangeIdentity)}
                                      onCheckedChange={() => handleToggleGroupSelection(group.exchangeIdentity)}
                                      disabled={addGroupPending}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold text-foreground">
                                        {group.displayName}
                                      </p>
                                      <p className="truncate text-[11px] text-muted-foreground">
                                        {group.primaryEmail ?? group.exchangeIdentity}
                                      </p>
                                    </div>
                                    <Badge variant="outline">{GROUP_KIND_LABELS[group.groupKind]}</Badge>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                      )}
                    </>
                  )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button size="sm" onClick={handleDetailClose} disabled={recipientDialogPending}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={removeGroupTarget !== null}
        onOpenChange={(open) => {
          if (!open && canDismissMutationDialog(removeGroupPending)) {
            setRemoveGroupTarget(null);
            setRemoveGroupError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={canDismissMutationDialog(removeGroupPending)}>
          <DialogHeader>
            <DialogTitle>Remove from group</DialogTitle>
            <DialogDescription>
              {removeGroupTarget && detailTarget
                ? `Remove ${detailTarget.displayName} from ${removeGroupTarget.displayName}?`
                : "Remove this membership?"}
            </DialogDescription>
          </DialogHeader>

          {removeGroupError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Remove failed</AlertTitle>
              <AlertDescription>{removeGroupError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              disabled={removeGroupPending}
              onClick={() => setRemoveGroupTarget(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={removeGroupPending || !currentMemberRef}
              onClick={() => {
                void handleRemoveGroup();
              }}
            >
              {removeGroupPending && <Loader2 className="mr-1 size-3.5 animate-spin" />}
              Remove from group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
