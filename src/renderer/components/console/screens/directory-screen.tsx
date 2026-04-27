import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  Loader2,
  AlertCircle,
  WifiOff,
  Search,
  Info,
  CheckCircle2,
  ShieldAlert,
  Copy,
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
import { Button } from "@/renderer/components/ui/button";
import { Badge } from "@/renderer/components/ui/badge";
import { Avatar, AvatarFallback } from "@/renderer/components/ui/avatar";
import { Input } from "@/renderer/components/ui/input";
import { Textarea } from "@/renderer/components/ui/textarea";
import { Checkbox } from "@/renderer/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/renderer/components/ui/collapsible";
import { Alert, AlertTitle, AlertDescription } from "@/renderer/components/ui/alert";
import { Separator } from "@/renderer/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/renderer/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/renderer/components/ui/sheet";
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
} from "@/renderer/components/console";
import { RecipientDetailDialog } from "@/renderer/components/console/directory/recipient-detail-dialog";
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
import {
  formatSingleRemoveMemberSuccessDescription,
  getPrimaryRemoveMemberStatus,
  getRemoveMembersIssueMessage,
  isRemoveMemberStatusClean,
  REMOVE_MEMBER_STATUS_LABELS,
} from "@/renderer/components/console/group-members-mutation-outcome";
import { cn } from "@/renderer/lib/utils";
import { toast } from "sonner";
import type {
  RecipientSearchItem,
  RecipientSearchType,
} from "@/shared/contracts/recipients";
import type {
  ExchangeGroupListItem,
  ExchangeGroupRef,
  GroupMemberSelectionRef,
  GroupsAddMembersResult,
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

const ADD_STATUS_LABELS: Record<GroupsAddMembersResult["items"][number]["status"], string> = {
  added: "Added",
  alreadyMember: "Already a member",
  invalid: "Invalid",
  verificationFailed: "Verification failed",
  failed: "Failed",
};

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

const CONTACT_ALIAS_PATTERN = /^[A-Za-z0-9!#%*+\-/=?^_~]+(?:\.[A-Za-z0-9!#%*+\-/=?^_~]+)*$/;
const BASIC_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CREATE_IDENTITY_INPUT_CLASS =
  "h-9 w-full min-w-0 rounded-md border-slate-300 bg-white px-3 text-sm text-slate-800 shadow-none placeholder:text-slate-400 focus-visible:border-teal-700 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600/25";
const CREATE_IDENTITY_TEXTAREA_CLASS =
  "min-h-20 w-full min-w-0 resize-none rounded-md border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-none placeholder:text-slate-400 focus-visible:border-teal-700 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600/25";
const CREATE_IDENTITY_LABEL_CLASS =
  "mb-1 block text-[10px] font-semibold uppercase leading-4 tracking-normal text-slate-500";

function optionalTrimmed(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formatRedeemUrlDisplay(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

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

function isAddStatusClean(status: GroupsAddMembersResult["items"][number]["status"]): boolean {
  return status === "added" || status === "alreadyMember";
}

function showAddGroupsToast(
  batchResults: Array<{ group: ExchangeGroupListItem; result: GroupsAddMembersResult }>,
): void {
  const issues = batchResults.flatMap(({ group, result }) => {
    if (result.items.length === 0) {
      return [{
        groupName: group.displayName,
        label: "No result",
        detail: "No membership result was returned.",
      }];
    }

    return result.items
      .filter((item) => !isAddStatusClean(item.status))
      .map((item) => ({
        groupName: group.displayName,
        label: ADD_STATUS_LABELS[item.status],
        detail: item.detail,
      }));
  });

  if (issues.length > 0) {
    toast.warning("Some group updates need attention", {
      description: issues
        .map((issue) =>
          `${issue.groupName}: ${issue.label} - ${issue.detail}`,
        )
        .join("\n"),
    });
    return;
  }

  const cleanStatuses = batchResults.flatMap(({ result }) =>
    result.items.map((item) => item.status),
  );
  const addedCount = cleanStatuses.filter((status) => status === "added").length;
  const alreadyMemberCount = cleanStatuses.filter((status) => status === "alreadyMember").length;

  if (addedCount > 0 && alreadyMemberCount === 0) {
    toast.success(addedCount === 1 ? "Added to group" : "Added to groups", {
      description: `${addedCount} membership${addedCount === 1 ? "" : "s"} added`,
    });
    return;
  }

  if (addedCount === 0) {
    toast.success("Already a member", {
      description: `${alreadyMemberCount} membership${alreadyMemberCount === 1 ? "" : "s"} already existed`,
    });
    return;
  }

  toast.success("Group memberships updated", {
    description: `${addedCount} added; ${alreadyMemberCount} already existed`,
  });
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

export function DirectoryScreen() {
  const { shell, directoryScreenState, setDirectoryScreenState } = useApp();
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

  const { activeTab, searchText, effectiveQuery } = directoryScreenState;
  const setActiveTab = useCallback((value: string) => {
    setDirectoryScreenState((previous) => ({
      ...previous,
      activeTab: value,
    }));
  }, [setDirectoryScreenState]);
  const setSearchText = useCallback((value: string) => {
    setDirectoryScreenState((previous) => ({
      ...previous,
      searchText: value,
    }));
  }, [setDirectoryScreenState]);
  const setEffectiveQuery = useCallback((value: string) => {
    setDirectoryScreenState((previous) => ({
      ...previous,
      effectiveQuery: value,
    }));
  }, [setDirectoryScreenState]);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>("contact");
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [createAlias, setCreateAlias] = useState("");
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createCompanyName, setCreateCompanyName] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createDepartment, setCreateDepartment] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createOffice, setCreateOffice] = useState("");
  const [createStreetAddress, setCreateStreetAddress] = useState("");
  const [createCity, setCreateCity] = useState("");
  const [createStateOrProvince, setCreateStateOrProvince] = useState("");
  const [createPostalCode, setCreatePostalCode] = useState("");
  const [createCountryOrRegion, setCreateCountryOrRegion] = useState("");
  const [createSendInvitation, setCreateSendInvitation] = useState(true);
  const [createInvitationCcEmail, setCreateInvitationCcEmail] = useState("");
  const [createInvitationMessage, setCreateInvitationMessage] = useState("");
  const [createGuestProfileOpen, setCreateGuestProfileOpen] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createRedeemUrlCopied, setCreateRedeemUrlCopied] = useState(false);

  const [updateCompanyName, setUpdateCompanyName] = useState("");
  const [updatePending, setUpdatePending] = useState(false);
  const [updateResult, setUpdateResult] = useState<
    | { mode: "contact"; data: ContactsUpdateCompanyResult }
    | { mode: "guest"; data: GuestsUpdateCompanyResult }
    | null
  >(null);

  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<RecipientSearchItem | null>(null);

  const [removeGroupTarget, setRemoveGroupTarget] = useState<ExchangeGroupListItem | null>(null);
  const [removeGroupPending, setRemoveGroupPending] = useState(false);
  const [removeGroupError, setRemoveGroupError] = useState<string | null>(null);

  const [groupFilterText, setGroupFilterText] = useState("");
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<Set<string>>(new Set());
  const [addGroupPending, setAddGroupPending] = useState(false);
  const [addGroupError, setAddGroupError] = useState<string | null>(null);

  const canCreateContact = exchangeConnected;
  const canCreateGuest = graphConnected && graphTenantMatched;
  const canCreateAny = canCreateContact || canCreateGuest;

  useEffect(() => {
    const timer = setTimeout(() => {
      setEffectiveQuery(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, setEffectiveQuery]);

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
  }, [
    activeTab,
    exchangeConnectionIdentity,
    graphConnectionIdentity,
    shell.exchangeConnection,
    shell.graphConnection,
  ]);

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
      refetch: () => Promise.resolve(undefined),
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
    setCreateDisplayName("");
    setCreateAlias("");
    setCreateFirstName("");
    setCreateLastName("");
    setCreateEmail("");
    setCreateCompanyName("");
    setCreateTitle("");
    setCreateDepartment("");
    setCreatePhone("");
    setCreateOffice("");
    setCreateStreetAddress("");
    setCreateCity("");
    setCreateStateOrProvince("");
    setCreatePostalCode("");
    setCreateCountryOrRegion("");
    setCreateSendInvitation(true);
    setCreateInvitationCcEmail("");
    setCreateInvitationMessage("");
    setCreateGuestProfileOpen(false);
    setCreatePending(false);
    setCreateResult(null);
    setCreateError(null);
    setCreateRedeemUrlCopied(false);
    setCreateDialogOpen(true);
  }, [activeTab, canCreateContact, canCreateGuest]);

  const handleCreateSubmit = async () => {
    setCreatePending(true);
    setCreateError(null);
    try {
      if (createMode === "contact") {
        const result = await createContactMutation.mutateAsync({
          displayName: createDisplayName.trim(),
          alias: createAlias.trim(),
          firstName: optionalTrimmed(createFirstName),
          lastName: optionalTrimmed(createLastName),
          email: createEmail.trim(),
          companyName: optionalTrimmed(createCompanyName),
          title: optionalTrimmed(createTitle),
          department: optionalTrimmed(createDepartment),
          phone: optionalTrimmed(createPhone),
          office: optionalTrimmed(createOffice),
          streetAddress: optionalTrimmed(createStreetAddress),
          city: optionalTrimmed(createCity),
          stateOrProvince: optionalTrimmed(createStateOrProvince),
          postalCode: optionalTrimmed(createPostalCode),
          countryOrRegion: optionalTrimmed(createCountryOrRegion),
        });
        setCreateResult({ mode: "contact", data: result });
      } else {
        const payload: {
          email: string;
          displayName?: string;
          companyName?: string;
          jobTitle?: string;
          department?: string;
          officeLocation?: string;
          mobilePhone?: string;
          sendInvitationMessage?: boolean;
          invitationMessage?: string;
          invitationCcEmail?: string;
        } = { email: createEmail.trim() };
        const displayNameTrimmed = createFirstName.trim();
        if (displayNameTrimmed) {
          payload.displayName = displayNameTrimmed;
        }
        const companyNameTrimmed = createCompanyName.trim();
        if (companyNameTrimmed) {
          payload.companyName = companyNameTrimmed;
        }
        const titleTrimmed = createTitle.trim();
        if (titleTrimmed) {
          payload.jobTitle = titleTrimmed;
        }
        const departmentTrimmed = createDepartment.trim();
        if (departmentTrimmed) {
          payload.department = departmentTrimmed;
        }
        const officeTrimmed = createOffice.trim();
        if (officeTrimmed) {
          payload.officeLocation = officeTrimmed;
        }
        const phoneTrimmed = createPhone.trim();
        if (phoneTrimmed) {
          payload.mobilePhone = phoneTrimmed;
        }
        payload.sendInvitationMessage = createSendInvitation;
        if (createSendInvitation) {
          const messageTrimmed = createInvitationMessage.trim();
          if (messageTrimmed) {
            payload.invitationMessage = messageTrimmed;
          }
          const ccEmailTrimmed = createInvitationCcEmail.trim();
          if (ccEmailTrimmed) {
            payload.invitationCcEmail = ccEmailTrimmed;
          }
        }
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

  const handleCopyRedeemUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCreateRedeemUrlCopied(true);
      toast.success("Invitation URL copied.");
    } catch {
      setCreateError("Invitation URL could not be copied automatically.");
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
    setCreateRedeemUrlCopied(false);
  };

  const handleUpdateSubmit = async () => {
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
    } catch (err: unknown) {
      const message = formatPresentedCommandFailure(
        presentCommandFailure(err, "Update Error", "Operation failed."),
      );
      toast.error("Failed to update company", { description: message });
    } finally {
      setUpdatePending(false);
    }
  };

  const handleUpdateClose = useCallback(() => {
    setUpdateResult(null);
    setUpdatePending(false);
  }, []);

  const openRecipientDialog = useCallback((item: RecipientSearchItem) => {
    setDetailTarget(item);
    setDetailDialogOpen(true);
    setUpdateCompanyName(item.companyName ?? "");
    setUpdatePending(false);
    setUpdateResult(null);
    setGroupFilterText("");
    setSelectedGroupKeys(new Set());
    setAddGroupPending(false);
    setAddGroupError(null);
    setRemoveGroupTarget(null);
    setRemoveGroupPending(false);
    setRemoveGroupError(null);
  }, []);

  const handleDetailClose = useCallback(() => {
    handleUpdateClose();
    setDetailDialogOpen(false);
    setDetailTarget(null);
    setUpdateCompanyName("");
    setGroupFilterText("");
    setSelectedGroupKeys(new Set());
    setAddGroupPending(false);
    setAddGroupError(null);
    setRemoveGroupTarget(null);
    setRemoveGroupPending(false);
    setRemoveGroupError(null);
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

  const handleSelectAllFiltered = useCallback(() => {
    setSelectedGroupKeys((previous) => {
      const next = new Set(previous);
      for (const g of filteredAvailableGroups) {
        next.add(g.exchangeIdentity);
      }
      return next;
    });
  }, [filteredAvailableGroups]);

  const handleClearSelection = useCallback(() => {
    setSelectedGroupKeys(new Set());
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

    try {
      const batchResults: Array<{ group: ExchangeGroupListItem; result: GroupsAddMembersResult }> = [];

      for (const group of groupsToAdd) {
        const result = await addGroupMembersMutation.mutateAsync({
          groupRef: groupRefFromListItem(group),
          memberRefs: [memberSelectionRef],
        });

        batchResults.push({ group, result });
      }

      showAddGroupsToast(batchResults);
      setSelectedGroupKeys(new Set());
      await membershipsQuery.refetch();
    } catch (err: unknown) {
      const message = formatPresentedCommandFailure(
        presentCommandFailure(err, "Add to Groups Error", "Failed to add to selected groups."),
      );
      setAddGroupError(message);
      toast.error("Failed to add to selected groups", { description: message });
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

    try {
      const result = await removeGroupMembersMutation.mutateAsync({
        groupRef: groupRefFromListItem(removeGroupTarget),
        memberRefs: [currentMemberRef],
      });

      const status = getPrimaryRemoveMemberStatus(result, "failed");

      if (isRemoveMemberStatusClean(status)) {
        toast.success(REMOVE_MEMBER_STATUS_LABELS[status], {
          description: formatSingleRemoveMemberSuccessDescription(
            detailTarget?.displayName ?? "Recipient",
            removeGroupTarget.displayName,
            result,
          ),
        });
        setRemoveGroupTarget(null);
        await membershipsQuery.refetch();
        return;
      }

      const message =
        getRemoveMembersIssueMessage(result) ??
        `${REMOVE_MEMBER_STATUS_LABELS[status]}: Membership update failed.`;
      setRemoveGroupError(message);
      toast.warning("Remove from group needs attention", {
        description: `${removeGroupTarget.displayName}: ${message}`,
      });

    } catch (err: unknown) {
      const message = formatPresentedCommandFailure(
        presentCommandFailure(err, "Remove From Group Error", "Failed to remove from group."),
      );
      setRemoveGroupError(message);
      toast.error("Failed to remove from group", { description: message });
    } finally {
      setRemoveGroupPending(false);
    }
  }, [currentMemberRef, detailTarget?.displayName, membershipsQuery, removeGroupMembersMutation, removeGroupTarget]);

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
      ? createDisplayName.trim().length > 0 &&
        createDisplayName.trim().length <= 256 &&
        createAlias.trim().length > 0 &&
        createAlias.trim().length <= 64 &&
        CONTACT_ALIAS_PATTERN.test(createAlias.trim()) &&
        BASIC_EMAIL_PATTERN.test(createEmail.trim()) &&
        createFirstName.trim().length <= 128 &&
        createLastName.trim().length <= 128 &&
        createCompanyName.trim().length <= 256 &&
        createTitle.trim().length <= 256 &&
        createDepartment.trim().length <= 256 &&
        createPhone.trim().length <= 64 &&
        createOffice.trim().length <= 256 &&
        createStreetAddress.trim().length <= 256 &&
        createCity.trim().length <= 128 &&
        createStateOrProvince.trim().length <= 128 &&
        createPostalCode.trim().length <= 40 &&
        createCountryOrRegion.trim().length <= 128
      : BASIC_EMAIL_PATTERN.test(createEmail.trim()) &&
        createFirstName.trim().length <= 256 &&
        createCompanyName.trim().length <= 64 &&
        createTitle.trim().length <= 128 &&
        createDepartment.trim().length <= 128 &&
        createOffice.trim().length <= 128 &&
        createPhone.trim().length <= 64 &&
        (!createSendInvitation ||
          ((createInvitationMessage.trim().length === 0 ||
            createInvitationMessage.trim().length <= 1000) &&
            (createInvitationCcEmail.trim().length === 0 ||
              BASIC_EMAIL_PATTERN.test(createInvitationCcEmail.trim()))));

  const createEmailError =
    createEmail.trim().length > 0 && !BASIC_EMAIL_PATTERN.test(createEmail.trim())
      ? "Enter a valid email address."
      : null;

  const contactAliasError =
    createMode === "contact" && createAlias.trim().length > 0 && !CONTACT_ALIAS_PATTERN.test(createAlias.trim())
      ? "Alias cannot contain spaces. Use letters, numbers, ! # % * + - / = ? ^ _ ~, and periods between characters."
      : null;

  const guestCcEmailError =
    createMode === "guest" &&
    createSendInvitation &&
    createInvitationCcEmail.trim().length > 0 &&
    !BASIC_EMAIL_PATTERN.test(createInvitationCcEmail.trim())
      ? "Enter a valid CC email address."
      : null;

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

  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex justify-end items-center mb-3">
            <div className="flex gap-2">
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
              searchValue={searchText}
              onSearch={setSearchText}
              filters={
                <>
                  <FilterSegmentedControl
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                  />
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
                    Searching directory…
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

      <Sheet
        open={createDialogOpen}
        onOpenChange={(open) => {
          handleMutationDialogOpenChange(open, createPending, handleCreateClose);
        }}
      >
        <SheetContent
          className="w-full max-w-full gap-0 overflow-hidden bg-white p-0 data-[side=right]:w-full data-[side=right]:sm:w-[500px] data-[side=right]:sm:max-w-[500px] data-[state=closed]:duration-200 data-[state=open]:duration-300"
          showCloseButton={canDismissMutationDialog(createPending)}
        >
          <SheetHeader className="shrink-0 border-b border-slate-200 px-5 py-4 pr-14">
            <SheetTitle className="text-lg font-semibold tracking-normal text-slate-900">
              {createResult && createResult.data.outcome === "blockedConflict"
                ? "Creation Blocked"
                : "Create Identity"}
            </SheetTitle>
            <SheetDescription className="max-w-lg text-sm leading-5 text-slate-600">
              {createResult
                ? createResult.data.outcome === "blockedConflict"
                  ? "This identity could not be created due to a blocking conflict."
                  : "Identity created successfully."
                : "Create a new contact or invite a guest user to the directory."}
            </SheetDescription>
          </SheetHeader>

          {createResult ? (
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
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
                  <div
                    className={cn(
                      "flex items-start gap-2 rounded-md px-3 py-2 text-xs",
                      createResult.data.verification.companyApplied
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-amber-50 text-amber-800",
                    )}
                  >
                    {createResult.data.verification.companyApplied ? (
                      <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-600" />
                    )}
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
                      {createResult.data.verification.companyApplied ? "Verification" : "Needs attention"}:{" "}
                      {createResult.data.verification.detail}
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
                  {createResult.data.companyUpdate.attempted && (
                    <div className="text-[11px] text-slate-500">
                      Profile update: {createResult.data.companyUpdate.detail}
                    </div>
                  )}
                  {createResult.data.inviteRedeemUrl && (
                    <div className="space-y-1.5 rounded-md border border-slate-200 bg-slate-50 p-3">
                      <label className={CREATE_IDENTITY_LABEL_CLASS}>
                        Invitation URL
                      </label>
                      <div className="flex gap-2">
                        <div
                          className="flex h-8 min-w-0 flex-1 items-center truncate rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
                          title={createResult.data.inviteRedeemUrl}
                        >
                          {formatRedeemUrlDisplay(createResult.data.inviteRedeemUrl)}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0"
                          onClick={() => {
                            if (createResult.data.outcome === "invited" && createResult.data.inviteRedeemUrl) {
                              void handleCopyRedeemUrl(createResult.data.inviteRedeemUrl);
                            }
                          }}
                        >
                          <Copy className="size-3.5" />
                          {createRedeemUrlCopied ? "Copied" : "Copy"}
                        </Button>
                      </div>
                      <p className="text-[11px] leading-4 text-slate-500">
                        Microsoft encodes this link; copy uses the exact redemption URL.
                      </p>
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
            <Tabs
              value={createMode}
              onValueChange={(value) => {
                if (value === "contact" && canCreateContact) {
                  setCreateMode("contact");
                  setCreateResult(null);
                  setCreateError(null);
                } else if (value === "guest" && canCreateGuest) {
                  setCreateMode("guest");
                  setCreateResult(null);
                  setCreateError(null);
                }
              }}
              className="min-h-0 flex-1 gap-0 overflow-hidden"
            >
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-4">
                <div className="mx-auto flex w-full max-w-[540px] flex-col gap-4">
                  <TabsList className="grid h-8 w-full grid-cols-2 rounded-md border border-slate-200 bg-slate-100 p-0.5">
                    <TabsTrigger
                      value="contact"
                      className="cursor-pointer rounded-[5px] border border-transparent text-xs font-semibold text-slate-600 hover:bg-white/70 hover:text-slate-900 data-[state=active]:border-teal-700 data-[state=active]:bg-teal-700 data-[state=active]:text-white data-[state=active]:shadow-sm disabled:cursor-not-allowed"
                      disabled={!canCreateContact}
                    >
                      Contact
                    </TabsTrigger>
                    <TabsTrigger
                      value="guest"
                      className="cursor-pointer rounded-[5px] border border-transparent text-xs font-semibold text-slate-600 hover:bg-white/70 hover:text-slate-900 data-[state=active]:border-teal-700 data-[state=active]:bg-teal-700 data-[state=active]:text-white data-[state=active]:shadow-sm disabled:cursor-not-allowed"
                      disabled={!canCreateGuest}
                    >
                      Guest
                    </TabsTrigger>
                  </TabsList>

                  <div className="min-w-0 max-w-full overflow-x-hidden">
                    <TabsContent value="contact" className="m-0 space-y-3">
                  <div>
                    <label className={CREATE_IDENTITY_LABEL_CLASS}>
                      Display Name <span className="text-[var(--color-error)]">*</span>
                    </label>
                    <Input
                      className={CREATE_IDENTITY_INPUT_CLASS}
                      placeholder="Jane Example"
                      value={createDisplayName}
                      onChange={(e) => setCreateDisplayName(e.target.value)}
                      disabled={createPending}
                      maxLength={256}
                    />
                  </div>
                  <div>
                    <label className={CREATE_IDENTITY_LABEL_CLASS}>
                      Alias <span className="text-[var(--color-error)]">*</span>
                    </label>
                    <Input
                      className={cn(
                        CREATE_IDENTITY_INPUT_CLASS,
                        contactAliasError && "border-[var(--color-error)] focus-visible:ring-red-200",
                      )}
                      placeholder="jane.example"
                      value={createAlias}
                      onChange={(e) => setCreateAlias(e.target.value)}
                      disabled={createPending}
                      maxLength={64}
                    />
                    {contactAliasError && (
                      <p className="mt-1 text-[11px] text-[var(--color-error)]">
                        {contactAliasError}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={CREATE_IDENTITY_LABEL_CLASS}>
                        First Name
                      </label>
                      <Input
                        className={CREATE_IDENTITY_INPUT_CLASS}
                        placeholder="First name"
                        value={createFirstName}
                        onChange={(e) => setCreateFirstName(e.target.value)}
                        disabled={createPending}
                        maxLength={128}
                      />
                    </div>
                    <div>
                      <label className={CREATE_IDENTITY_LABEL_CLASS}>
                        Last Name
                      </label>
                      <Input
                        className={CREATE_IDENTITY_INPUT_CLASS}
                        placeholder="Last name"
                        value={createLastName}
                        onChange={(e) => setCreateLastName(e.target.value)}
                        disabled={createPending}
                        maxLength={128}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={CREATE_IDENTITY_LABEL_CLASS}>
                      Email <span className="text-[var(--color-error)]">*</span>
                    </label>
                    <Input
                      className={cn(
                        CREATE_IDENTITY_INPUT_CLASS,
                        createEmailError && "border-[var(--color-error)] focus-visible:ring-red-200",
                      )}
                      placeholder="email@example.com"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      pattern={BASIC_EMAIL_PATTERN.source}
                      aria-invalid={createEmailError ? true : undefined}
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      disabled={createPending}
                    />
                    {createEmailError && (
                      <p className="mt-1 text-[11px] text-[var(--color-error)]">
                        {createEmailError}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={CREATE_IDENTITY_LABEL_CLASS}>
                      Company Name
                    </label>
                    <Input
                      className={CREATE_IDENTITY_INPUT_CLASS}
                      placeholder="Company name"
                      value={createCompanyName}
                      onChange={(e) => setCreateCompanyName(e.target.value)}
                      disabled={createPending}
                      maxLength={256}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={CREATE_IDENTITY_LABEL_CLASS}>
                        Title
                      </label>
                      <Input
                        className={CREATE_IDENTITY_INPUT_CLASS}
                        placeholder="Director"
                        value={createTitle}
                        onChange={(e) => setCreateTitle(e.target.value)}
                        disabled={createPending}
                        maxLength={256}
                      />
                    </div>
                    <div>
                      <label className={CREATE_IDENTITY_LABEL_CLASS}>
                        Department
                      </label>
                      <Input
                        className={CREATE_IDENTITY_INPUT_CLASS}
                        placeholder="Operations"
                        value={createDepartment}
                        onChange={(e) => setCreateDepartment(e.target.value)}
                        disabled={createPending}
                        maxLength={256}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={CREATE_IDENTITY_LABEL_CLASS}>
                        Phone
                      </label>
                      <Input
                        className={CREATE_IDENTITY_INPUT_CLASS}
                        placeholder="+1 555-0100"
                        value={createPhone}
                        onChange={(e) => setCreatePhone(e.target.value)}
                        disabled={createPending}
                        maxLength={64}
                      />
                    </div>
                    <div>
                      <label className={CREATE_IDENTITY_LABEL_CLASS}>
                        Office
                      </label>
                      <Input
                        className={CREATE_IDENTITY_INPUT_CLASS}
                        placeholder="HQ-201"
                        value={createOffice}
                        onChange={(e) => setCreateOffice(e.target.value)}
                        disabled={createPending}
                        maxLength={256}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={CREATE_IDENTITY_LABEL_CLASS}>
                      Street Address
                    </label>
                    <Input
                      className={CREATE_IDENTITY_INPUT_CLASS}
                      placeholder="1 Example Way"
                      value={createStreetAddress}
                      onChange={(e) => setCreateStreetAddress(e.target.value)}
                      disabled={createPending}
                      maxLength={256}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={CREATE_IDENTITY_LABEL_CLASS}>
                        City
                      </label>
                      <Input
                        className={CREATE_IDENTITY_INPUT_CLASS}
                        placeholder="New York"
                        value={createCity}
                        onChange={(e) => setCreateCity(e.target.value)}
                        disabled={createPending}
                        maxLength={128}
                      />
                    </div>
                    <div>
                      <label className={CREATE_IDENTITY_LABEL_CLASS}>
                        State / Province
                      </label>
                      <Input
                        className={CREATE_IDENTITY_INPUT_CLASS}
                        placeholder="NY"
                        value={createStateOrProvince}
                        onChange={(e) => setCreateStateOrProvince(e.target.value)}
                        disabled={createPending}
                        maxLength={128}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={CREATE_IDENTITY_LABEL_CLASS}>
                        Postal Code
                      </label>
                      <Input
                        className={CREATE_IDENTITY_INPUT_CLASS}
                        placeholder="10001"
                        value={createPostalCode}
                        onChange={(e) => setCreatePostalCode(e.target.value)}
                        disabled={createPending}
                        maxLength={40}
                      />
                    </div>
                    <div>
                      <label className={CREATE_IDENTITY_LABEL_CLASS}>
                        Country / Region
                      </label>
                      <Input
                        className={CREATE_IDENTITY_INPUT_CLASS}
                        placeholder="US"
                        value={createCountryOrRegion}
                        onChange={(e) => setCreateCountryOrRegion(e.target.value)}
                        disabled={createPending}
                        maxLength={128}
                      />
                    </div>
                  </div>
                    </TabsContent>
                    <TabsContent value="guest" className="m-0 space-y-3">
                  <div>
                    <label className={CREATE_IDENTITY_LABEL_CLASS}>
                      Email <span className="text-[var(--color-error)]">*</span>
                    </label>
                    <Input
                      className={cn(
                        CREATE_IDENTITY_INPUT_CLASS,
                        createEmailError && "border-[var(--color-error)] focus-visible:ring-red-200",
                      )}
                      placeholder="guest@example.com"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      pattern={BASIC_EMAIL_PATTERN.source}
                      aria-invalid={createEmailError ? true : undefined}
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      disabled={createPending}
                    />
                    {createEmailError && (
                      <p className="mt-1 text-[11px] text-[var(--color-error)]">
                        {createEmailError}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={CREATE_IDENTITY_LABEL_CLASS}>
                      Display Name
                    </label>
                    <Input
                      className={CREATE_IDENTITY_INPUT_CLASS}
                      placeholder="Optional display name"
                      value={createFirstName}
                      onChange={(e) => setCreateFirstName(e.target.value)}
                      disabled={createPending}
                      maxLength={256}
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
                  {createSendInvitation && (
                    <>
                      <div>
                        <label className={CREATE_IDENTITY_LABEL_CLASS}>
                          CC Email
                        </label>
                        <Input
                          className={cn(
                            CREATE_IDENTITY_INPUT_CLASS,
                            guestCcEmailError && "border-[var(--color-error)] focus-visible:ring-red-200",
                          )}
                          placeholder="manager@example.com"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          pattern={BASIC_EMAIL_PATTERN.source}
                          aria-invalid={guestCcEmailError ? true : undefined}
                          value={createInvitationCcEmail}
                          onChange={(e) => setCreateInvitationCcEmail(e.target.value)}
                          disabled={createPending}
                        />
                        {guestCcEmailError && (
                          <p className="mt-1 text-[11px] text-[var(--color-error)]">
                            {guestCcEmailError}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className={CREATE_IDENTITY_LABEL_CLASS}>
                          Custom Message
                        </label>
                        <Textarea
                          className={CREATE_IDENTITY_TEXTAREA_CLASS}
                          placeholder="Optional plain-text invitation message"
                          value={createInvitationMessage}
                          onChange={(e) => setCreateInvitationMessage(e.target.value)}
                          disabled={createPending}
                          maxLength={1000}
                        />
                      </div>
                    </>
                  )}
                  <Collapsible
                    open={createGuestProfileOpen}
                    onOpenChange={setCreateGuestProfileOpen}
                    className="rounded-md border border-slate-200 bg-slate-50/70"
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto w-full justify-between rounded-md px-3 py-2 text-left hover:bg-slate-100"
                        disabled={createPending}
                      >
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-slate-800">
                            Profile details
                          </span>
                          <span className="block text-[11px] font-normal leading-4 text-slate-500">
                            Optional. Applied after the invitation is created.
                          </span>
                        </span>
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 text-slate-500 transition-transform",
                            createGuestProfileOpen && "rotate-180",
                          )}
                        />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-3 border-t border-slate-200 px-3 py-3">
                        <p className="text-[11px] leading-4 text-slate-500">
                          Requires Microsoft Graph user profile update permissions. If your account cannot update
                          guest profiles, the invite will still be created and the profile failure will be shown.
                        </p>
                        <div>
                          <label className={CREATE_IDENTITY_LABEL_CLASS}>
                            Company Name
                          </label>
                          <Input
                            className={CREATE_IDENTITY_INPUT_CLASS}
                            placeholder="Company name"
                            value={createCompanyName}
                            onChange={(e) => setCreateCompanyName(e.target.value)}
                            disabled={createPending}
                            maxLength={64}
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className={CREATE_IDENTITY_LABEL_CLASS}>
                              Job Title
                            </label>
                            <Input
                              className={CREATE_IDENTITY_INPUT_CLASS}
                              placeholder="Consultant"
                              value={createTitle}
                              onChange={(e) => setCreateTitle(e.target.value)}
                              disabled={createPending}
                              maxLength={128}
                            />
                          </div>
                          <div>
                            <label className={CREATE_IDENTITY_LABEL_CLASS}>
                              Department
                            </label>
                            <Input
                              className={CREATE_IDENTITY_INPUT_CLASS}
                              placeholder="Operations"
                              value={createDepartment}
                              onChange={(e) => setCreateDepartment(e.target.value)}
                              disabled={createPending}
                              maxLength={128}
                            />
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className={CREATE_IDENTITY_LABEL_CLASS}>
                              Office
                            </label>
                            <Input
                              className={CREATE_IDENTITY_INPUT_CLASS}
                              placeholder="HQ-201"
                              value={createOffice}
                              onChange={(e) => setCreateOffice(e.target.value)}
                              disabled={createPending}
                              maxLength={128}
                            />
                          </div>
                          <div>
                            <label className={CREATE_IDENTITY_LABEL_CLASS}>
                              Phone
                            </label>
                            <Input
                              className={CREATE_IDENTITY_INPUT_CLASS}
                              placeholder="+1 555-0100"
                              value={createPhone}
                              onChange={(e) => setCreatePhone(e.target.value)}
                              disabled={createPending}
                              maxLength={64}
                            />
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                    </TabsContent>
                  </div>
                </div>
              </div>
            </Tabs>
          )}

          {createError && (
            <div className="mx-4 mb-3 flex shrink-0 items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-[var(--color-error)]">
              <AlertCircle className="size-4 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          <SheetFooter className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 sm:flex-row-reverse sm:justify-start">
            {createResult ? (
              <Button className="h-9 w-full rounded-md sm:w-auto sm:min-w-28" onClick={handleCreateClose}>
                Close
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="h-9 w-full rounded-md sm:w-auto sm:min-w-28"
                  onClick={handleCreateClose}
                  disabled={createPending}
                >
                  Cancel
                </Button>
                <Button
                  className="h-9 w-full rounded-md bg-teal-700 text-sm font-semibold text-white hover:bg-teal-800 sm:w-auto sm:min-w-32"
                  disabled={!createFormValid || createPending}
                  onClick={() => { void handleCreateSubmit(); }}
                >
                  {createPending && <Loader2 className="size-3.5 mr-1 animate-spin" />}
                  {createMode === "contact" ? "Create Contact" : "Invite Guest"}
                </Button>
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <RecipientDetailDialog
        open={detailDialogOpen}
        onOpenChange={(open) => {
          if (!open && canDismissMutationDialog(recipientDialogPending)) {
            handleDetailClose();
          }
        }}
        canDismiss={canDismissMutationDialog(recipientDialogPending)}
        detailTarget={detailTarget}
        detailPending={detailPending}
        detailError={detailError}
        detailResult={detailResult}
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
        memberSelectionRef={memberSelectionRef}
        membershipsLoading={membershipsQuery.isLoading}
        membershipsError={membershipsQuery.error}
        currentMemberships={currentMemberships}
        onRefetchMemberships={() => {
          void membershipsQuery.refetch();
        }}
        allGroupsLoading={allGroupsLoading}
        allGroupsError={allGroupsError}
        onRefetchAllGroups={() => {
          void refetchAllGroups();
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
        selectedGroupsCount={selectedGroupsCount}
        addGroupPending={addGroupPending}
        onAddGroups={() => {
          void handleAddGroups();
        }}
        addGroupError={addGroupError}
        onRequestRemoveGroup={(group) => {
          setRemoveGroupError(null);
          setRemoveGroupTarget(group);
        }}
      />

      <Dialog
        open={removeGroupTarget !== null}
        onOpenChange={(open): void => {
          if (!open && canDismissMutationDialog(removeGroupPending)) {
            setRemoveGroupTarget(null);
            setRemoveGroupError(null);
          }
        }}
      >
        <DialogContent
          className="sm:max-w-sm"
          showCloseButton={canDismissMutationDialog(removeGroupPending)}
        >
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              {removeGroupTarget && detailTarget ? (
                <>
                  Are you sure you want to remove{" "}
                  <span className="font-semibold">{detailTarget.displayName}</span>
                  {detailTarget.primaryEmail && (
                    <span className="text-slate-500"> ({detailTarget.primaryEmail})</span>
                  )}
                  {" "}from{" "}
                  <span className="font-semibold">{removeGroupTarget.displayName}</span>?
                </>
              ) : (
                "Remove this membership?"
              )}
            </DialogDescription>
          </DialogHeader>

          {removeGroupError && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-error)] bg-red-50 rounded-md px-3 py-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{removeGroupError}</span>
            </div>
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
              variant="destructive"
              size="sm"
              disabled={removeGroupPending || !currentMemberRef}
              onClick={(): void => {
                void handleRemoveGroup();
              }}
            >
              {removeGroupPending && <Loader2 className="mr-1 size-3.5 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}


