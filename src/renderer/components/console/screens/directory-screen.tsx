import { useState, useEffect, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Edit,
  Loader2,
  AlertCircle,
  WifiOff,
  Search,
  Info,
  CheckCircle2,
  ShieldAlert,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/renderer/components/ui/dialog";
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
import {
  removeContactDetailsQuery,
  useContactDetailsQuery,
} from "@/renderer/hooks/use-contact-details";
import {
  removeGuestDetailsQuery,
  useGuestDetailsQuery,
} from "@/renderer/hooks/use-guest-details";
import { useExchangeRecipientDetailsQuery } from "@/renderer/hooks/use-exchange-recipient-details";
import {
  getExchangeConnectionIdentity,
  getGraphConnectionIdentity,
} from "@/renderer/lib/query-keys";
import { cn } from "@/renderer/lib/utils";
import type {
  RecipientSearchItem,
  RecipientSearchType,
} from "@/shared/contracts/recipients";
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

type UpdateResult =
  | { mode: "contact"; data: ContactsUpdateCompanyResult }
  | { mode: "guest"; data: GuestsUpdateCompanyResult };

type DetailResult =
  | { mode: "contact"; data: ContactDetails }
  | { mode: "guest"; data: GuestDetails }
  | { mode: "exchangeRecipient"; data: ExchangeRecipientDetails };

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

export function DirectoryScreen() {
  const { shell } = useApp();
  const queryClient = useQueryClient();
  const exchangeConnected = shell.exchangeConnection?.state === "connected";
  const graphConnected = shell.graphConnection?.state === "connected";
  const graphTenantMatched = shell.graphConnection?.exchangeAlignment === "matched";

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

  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updateTarget, setUpdateTarget] = useState<RecipientSearchItem | null>(null);
  const [updateCompanyName, setUpdateCompanyName] = useState("");
  const [updatePending, setUpdatePending] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<RecipientSearchItem | null>(null);

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
      return `${exchangeConnectionIdentity}|${graphConnectionIdentity}`;
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

  const refreshSearch = useCallback(() => {
    void searchQuery.refetch();
  }, [searchQuery]);

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
        const result = await window.radApp.contacts.create({
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
        const result = await window.radApp.guests.invite(payload);
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

  const openUpdateDialog = (item: RecipientSearchItem) => {
    setUpdateTarget(item);
    setUpdateCompanyName(item.companyName ?? "");
    setUpdatePending(false);
    setUpdateResult(null);
    setUpdateError(null);
    setUpdateDialogOpen(true);
  };

  const handleUpdateSubmit = async () => {
    if (!updateTarget) return;
    setUpdatePending(true);
    setUpdateError(null);
    try {
      const mode = getUpdateMode(updateTarget);
      if (mode === "contact") {
        const result = await window.radApp.contacts.updateCompany({
          exchangeIdentity: updateTarget.exchangeIdentity!,
          companyName: updateCompanyName.trim(),
        });
        setUpdateResult({ mode: "contact", data: result });
      } else {
        const result = await window.radApp.guests.updateCompany({
          guestUserId: updateTarget.objectId!,
          companyName: updateCompanyName.trim(),
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

  const handleUpdateClose = () => {
    if (updateResult) {
      if (updateTarget) {
        if (updateResult.mode === "contact") {
          removeContactDetailsQuery(queryClient, shell.exchangeConnection, updateTarget.stableKey);
        } else {
          removeGuestDetailsQuery(queryClient, shell.graphConnection, updateTarget.stableKey);
        }
      }
      void refreshSearch();
    }
    setUpdateDialogOpen(false);
    setUpdateTarget(null);
    setUpdateResult(null);
    setUpdateError(null);
  };

  const openDetailDialog = useCallback((item: RecipientSearchItem) => {
    setDetailTarget(item);
    setDetailDialogOpen(true);
  }, []);

  const handleDetailClose = useCallback(() => {
    setDetailDialogOpen(false);
    setDetailTarget(null);
  }, []);

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
                        <TableHead className="text-right w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results?.items.map((item) => {
                        const editable = canUpdateCompany(
                          item,
                          exchangeConnected,
                          graphConnected,
                          graphTenantMatched,
                        );
                        return (
                          <TableRow
                            key={item.stableKey}
                            className="hover:bg-teal-50/30 transition-colors group"
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
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-0.5">
                                {canInspect(item) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-6 transition-all p-1 opacity-0 group-hover:opacity-100 hover:text-[var(--color-primary)]"
                                    onClick={() => { void openDetailDialog(item); }}
                                  >
                                    <Info className="size-3" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    "size-6 transition-all p-1",
                                    editable
                                      ? "opacity-0 group-hover:opacity-100 hover:text-[var(--color-primary)]"
                                      : "opacity-0 cursor-default",
                                  )}
                                  disabled={!editable}
                                  onClick={editable ? () => openUpdateDialog(item) : undefined}
                                >
                                  <Edit className="size-3" />
                                </Button>
                              </div>
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

      <Dialog open={createDialogOpen} onOpenChange={(open) => { if (!open) handleCreateClose(); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
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
        open={updateDialogOpen}
        onOpenChange={(open) => { if (!open) handleUpdateClose(); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Company</DialogTitle>
            <DialogDescription>
              {updateTarget
                ? `Update the company name for ${updateTarget.displayName}.`
                : "Update the company name for this identity."}
            </DialogDescription>
          </DialogHeader>

          {updateTarget && !updateResult && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-md text-xs">
                <Avatar className="w-6 h-6 text-[10px]">
                  <AvatarFallback className={avatarColorFor(updateTarget.stableKey)}>
                    {getInitials(updateTarget.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">
                    {updateTarget.displayName}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {emailOrId(updateTarget)}
                  </p>
                </div>
                <Badge className={cn("ml-auto shrink-0", typeBadgeClass(updateTarget.recipientType))}>
                  {TYPE_LABELS[updateTarget.recipientType]}
                </Badge>
              </div>
              {updateTarget.companyName && (
                <p className="text-[11px] text-slate-500">
                  Current company: <span className="font-medium text-slate-700">{updateTarget.companyName}</span>
                </p>
              )}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1 block">
                  New Company Name <span className="text-[var(--color-error)]">*</span>
                </label>
                <Input
                  className="bg-slate-50 border-slate-200 text-xs"
                  placeholder="Enter new company name"
                  value={updateCompanyName}
                  onChange={(e) => setUpdateCompanyName(e.target.value)}
                  disabled={updatePending}
                />
              </div>
            </div>
          )}

          {updateResult && (
            <div className="space-y-2 py-2">
              <div className="flex items-start gap-2 rounded-md px-3 py-2 text-xs bg-emerald-50 text-emerald-800">
                <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600" />
                <div className="min-w-0">
                  <p className="font-semibold">Company updated</p>
                  {updateResult.mode === "contact" ? (
                    <p className="text-[11px] opacity-80">
                      {updateResult.data.contact.companyName ?? "Cleared"}
                    </p>
                  ) : (
                    <p className="text-[11px] opacity-80">
                      {updateResult.data.companyName ?? "Cleared"}
                    </p>
                  )}
                </div>
              </div>
              {updateResult.mode === "contact" ? (
                <div className="text-[11px] text-slate-500">
                  Verification: {updateResult.data.verification.detail}
                </div>
              ) : (
                <div className="text-[11px] text-slate-500">
                  Verification: {updateResult.data.verification.detail}
                </div>
              )}
            </div>
          )}

          {updateError && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-error)] bg-red-50 rounded-md px-3 py-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{updateError}</span>
            </div>
          )}

          <DialogFooter>
            {updateResult ? (
              <Button size="sm" onClick={handleUpdateClose}>
                Close
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={handleUpdateClose} disabled={updatePending}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={updateCompanyName.trim().length === 0 || updatePending}
                  onClick={() => { void handleUpdateSubmit(); }}
                >
                  {updatePending && <Loader2 className="size-3.5 mr-1 animate-spin" />}
                  Update Company
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailDialogOpen}
        onOpenChange={(open) => { if (!open) handleDetailClose(); }}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
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

          {detailPending ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="size-8 text-[var(--color-primary)] mx-auto mb-4 animate-spin" />
                <p className="text-sm text-slate-500">Loading details\u2026</p>
              </div>
            </div>
          ) : detailError ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center">
                <AlertCircle className="size-10 text-[var(--color-error)] mx-auto mb-4" />
                <h2 className="text-lg font-bold font-headline text-slate-700 mb-2">
                  Failed to Load Details
                </h2>
                <p className="text-sm text-slate-500 max-w-sm mb-4">
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
            <div className="flex-1 overflow-y-auto space-y-3 py-2">
              {detailResult.mode === "contact" ? (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-md">
                    <Avatar className="w-8 h-8 text-xs">
                      <AvatarFallback className={avatarColorFor(detailTarget?.stableKey ?? "")}>
                        {getInitials(detailResult.data.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800 truncate">
                        {detailResult.data.displayName}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {detailResult.data.primaryEmail ?? detailResult.data.alias ?? "\u2014"}
                      </p>
                    </div>
                    <Badge className={cn("shrink-0", typeBadgeClass("mailContact"))}>
                      CONTACT
                    </Badge>
                  </div>
                  <div className="space-y-0">
                    {detailResult.data.primaryEmail && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.primaryEmail}</span>
                      </div>
                    )}
                    {detailResult.data.alias && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Alias</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.alias}</span>
                      </div>
                    )}
                    {detailResult.data.companyName && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Company</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.companyName}</span>
                      </div>
                    )}
                    {detailResult.data.firstName && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">First Name</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.firstName}</span>
                      </div>
                    )}
                    {detailResult.data.lastName && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Last Name</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.lastName}</span>
                      </div>
                    )}
                    {detailResult.data.title && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Title</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.title}</span>
                      </div>
                    )}
                    {detailResult.data.department && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Department</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.department}</span>
                      </div>
                    )}
                    {detailResult.data.phone && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Phone</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.phone}</span>
                      </div>
                    )}
                    {detailResult.data.office && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Office</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.office}</span>
                      </div>
                    )}
                    {detailResult.data.streetAddress && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Street Address</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.streetAddress}</span>
                      </div>
                    )}
                    {detailResult.data.city && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">City</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.city}</span>
                      </div>
                    )}
                    {detailResult.data.stateOrProvince && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">State/Province</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.stateOrProvince}</span>
                      </div>
                    )}
                    {detailResult.data.postalCode && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Postal Code</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.postalCode}</span>
                      </div>
                    )}
                    {detailResult.data.countryOrRegion && (
                      <div className="flex justify-between py-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Country/Region</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.countryOrRegion}</span>
                      </div>
                    )}
                  </div>
                </>
              ) : detailResult.mode === "guest" ? (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-md">
                    <Avatar className="w-8 h-8 text-xs">
                      <AvatarFallback className={avatarColorFor(detailTarget?.stableKey ?? "")}>
                        {getInitials(detailResult.data.displayName ?? "")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800 truncate">
                        {detailResult.data.displayName ?? "\u2014"}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {detailResult.data.primaryEmail ?? detailResult.data.userPrincipalName ?? "\u2014"}
                      </p>
                    </div>
                    <Badge className={cn("shrink-0", typeBadgeClass("guestUser"))}>
                      GUEST
                    </Badge>
                  </div>
                  <div className="space-y-0">
                    {detailResult.data.primaryEmail && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.primaryEmail}</span>
                      </div>
                    )}
                    {detailResult.data.userPrincipalName && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">UPN</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.userPrincipalName}</span>
                      </div>
                    )}
                    {detailResult.data.companyName && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Company</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.companyName}</span>
                      </div>
                    )}
                    {detailResult.data.givenName && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">First Name</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.givenName}</span>
                      </div>
                    )}
                    {detailResult.data.surname && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Last Name</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.surname}</span>
                      </div>
                    )}
                    {detailResult.data.jobTitle && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Job Title</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.jobTitle}</span>
                      </div>
                    )}
                    {detailResult.data.department && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Department</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.department}</span>
                      </div>
                    )}
                    {detailResult.data.mobilePhone && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Mobile Phone</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.mobilePhone}</span>
                      </div>
                    )}
                    {detailResult.data.officeLocation && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Office Location</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.officeLocation}</span>
                      </div>
                    )}
                    {detailResult.data.preferredLanguage && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Preferred Language</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.preferredLanguage}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</span>
                      <span className={cn(
                        "text-xs font-medium",
                        detailResult.data.externalUserState === "Accepted"
                          ? "text-emerald-700"
                          : detailResult.data.externalUserState === "PendingAcceptance"
                            ? "text-amber-700"
                            : "text-slate-500",
                      )}>
                        {detailResult.data.externalUserState === "Accepted"
                          ? "Accepted"
                          : detailResult.data.externalUserState === "PendingAcceptance"
                            ? "Pending Acceptance"
                            : "Unknown"}
                      </span>
                    </div>
                    {detailResult.data.accountEnabled !== null && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Account Enabled</span>
                        <span className={cn(
                          "text-xs font-medium",
                          detailResult.data.accountEnabled ? "text-emerald-700" : "text-red-600",
                        )}>
                          {detailResult.data.accountEnabled ? "Yes" : "No"}
                        </span>
                      </div>
                    )}
                    {detailResult.data.createdDateTime && (
                      <div className="flex justify-between py-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Created</span>
                        <span className="text-xs text-slate-800">
                          {new Date(detailResult.data.createdDateTime).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-md">
                    <Avatar className="w-8 h-8 text-xs">
                      <AvatarFallback className={avatarColorFor(detailTarget?.stableKey ?? "")}>
                        {getInitials(detailResult.data.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800 truncate">
                        {detailResult.data.displayName}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {detailResult.data.primaryEmail ?? detailResult.data.alias ?? "\u2014"}
                      </p>
                    </div>
                    <Badge className={cn("shrink-0", typeBadgeClass(detailResult.data.recipientType))}>
                      {TYPE_LABELS[detailResult.data.recipientType]}
                    </Badge>
                  </div>
                  <div className="space-y-0">
                    {detailResult.data.primaryEmail && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.primaryEmail}</span>
                      </div>
                    )}
                    {detailResult.data.alias && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Alias</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.alias}</span>
                      </div>
                    )}
                    {detailResult.data.userPrincipalName && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">UPN</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.userPrincipalName}</span>
                      </div>
                    )}
                    {detailResult.data.externalEmailAddress && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">External Target</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.externalEmailAddress}</span>
                      </div>
                    )}
                    {detailResult.data.companyName && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Company</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.companyName}</span>
                      </div>
                    )}
                    {detailResult.data.firstName && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">First Name</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.firstName}</span>
                      </div>
                    )}
                    {detailResult.data.lastName && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Last Name</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.lastName}</span>
                      </div>
                    )}
                    {detailResult.data.title && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Title</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.title}</span>
                      </div>
                    )}
                    {detailResult.data.department && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Department</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.department}</span>
                      </div>
                    )}
                    {detailResult.data.phone && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Phone</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.phone}</span>
                      </div>
                    )}
                    {detailResult.data.office && (
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Office</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.office}</span>
                      </div>
                    )}
                    {detailResult.data.recipientTypeDetails && (
                      <div className="flex justify-between py-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Type Details</span>
                        <span className="text-xs text-slate-800 truncate max-w-[60%]">{detailResult.data.recipientTypeDetails}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button size="sm" onClick={handleDetailClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
