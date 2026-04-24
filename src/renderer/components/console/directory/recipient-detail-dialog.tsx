import { type ReactNode } from "react";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  UserMinus,
  Search,
} from "lucide-react";
import { Button } from "@/renderer/components/ui/button";
import { Badge } from "@/renderer/components/ui/badge";
import { Avatar, AvatarFallback } from "@/renderer/components/ui/avatar";
import { Input } from "@/renderer/components/ui/input";
import { Checkbox } from "@/renderer/components/ui/checkbox";
import { Alert, AlertTitle, AlertDescription } from "@/renderer/components/ui/alert";
import { Separator } from "@/renderer/components/ui/separator";
import { ScrollArea } from "@/renderer/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
} from "@/renderer/components/ui/dialog";
import { cn } from "@/renderer/lib/utils";
import type {
  RecipientSearchItem,
  RecipientSearchType,
} from "@/shared/contracts/recipients";
import type {
  ExchangeGroupListItem,
  GroupMemberSelectionRef,
  GroupsAddMembersResult,
  GroupsRemoveMembersResult,
} from "@/shared/contracts/exchange";
import type {
  ContactsUpdateCompanyResult,
  ContactDetails,
} from "@/shared/contracts/contacts";
import type {
  ExchangeRecipientDetails,
} from "@/shared/contracts/exchange";
import type {
  GuestsUpdateCompanyResult,
  GuestDetails,
} from "@/shared/contracts/guests";

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

const GROUP_KIND_LABELS: Record<ExchangeGroupListItem["groupKind"], string> = {
  distributionList: "Distribution",
  mailEnabledSecurityGroup: "Security",
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
  return status === "removed";
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

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
      return "border border-teal-200 bg-teal-50 text-xs font-semibold text-[var(--color-primary)]";
    case "distributionList":
    case "mailEnabledSecurityGroup":
      return "border-transparent bg-[var(--color-primary)] text-white text-xs font-semibold";
    case "guestUser":
      return "border border-orange-200 bg-orange-50 text-xs font-semibold text-[var(--color-tertiary)]";
    default:
      return "border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500";
  }
}

type DetailResult =
  | { mode: "contact"; data: ContactDetails }
  | { mode: "guest"; data: GuestDetails }
  | { mode: "exchangeRecipient"; data: ExchangeRecipientDetails };

type GroupAddBatchResult = {
  group: ExchangeGroupListItem;
  result: GroupsAddMembersResult;
};

interface DetailRowProps {
  label: string;
  value: ReactNode;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-1 py-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="block min-w-0 max-w-full whitespace-normal text-sm leading-snug text-foreground [overflow-wrap:anywhere] [word-break:break-word]">
        {value}
      </span>
    </div>
  );
}

interface ProfileHeaderProps {
  displayName: string;
  email: string;
  badgeClassName: string;
  badgeLabel: string;
  avatarKey: string;
}

function ProfileHeader({ displayName, email, badgeClassName, badgeLabel, avatarKey }: ProfileHeaderProps) {
  return (
    <div className="flex min-w-0 max-w-full items-center gap-3 overflow-hidden rounded-lg border border-border/50 bg-muted/50 px-4 py-3">
      <Avatar className="size-10 shrink-0 text-sm">
        <AvatarFallback className={avatarColorFor(avatarKey)}>
          {getInitials(displayName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-foreground truncate">{displayName}</p>
        <p className="text-sm text-muted-foreground truncate">{email}</p>
      </div>
      <Badge className={cn("max-w-24 shrink-0 whitespace-normal text-center leading-tight", badgeClassName)}>
        {badgeLabel}
      </Badge>
    </div>
  );
}

interface RecipientDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canDismiss: boolean;
  detailTarget: RecipientSearchItem | null;
  detailPending: boolean;
  detailError: string | null;
  detailResult: DetailResult | null;
  onRefetchDetails: () => void;
  detailCanUpdateCompany: boolean;
  updateCompanyName: string;
  onUpdateCompanyNameChange: (value: string) => void;
  updatePending: boolean;
  onUpdateSubmit: () => void;
  updateResult: { mode: "contact"; data: ContactsUpdateCompanyResult } | { mode: "guest"; data: GuestsUpdateCompanyResult } | null;
  updateError: string | null;
  memberSelectionRef: GroupMemberSelectionRef | null;
  membershipsLoading: boolean;
  membershipsError: string | null;
  currentMemberships: ExchangeGroupListItem[];
  onRefetchMemberships: () => void;
  allGroupsLoading: boolean;
  allGroupsError: string | null;
  onRefetchAllGroups: () => void;
  availableGroups: ExchangeGroupListItem[];
  filteredAvailableGroups: ExchangeGroupListItem[];
  groupFilterText: string;
  onGroupFilterTextChange: (value: string) => void;
  selectedGroupKeys: Set<string>;
  onToggleGroupSelection: (exchangeIdentity: string) => void;
  onSelectAllFiltered: () => void;
  onClearSelection: () => void;
  visibleSelectedGroupsCount: number;
  hasHiddenSelectedGroups: boolean;
  selectedGroupsCount: number;
  addGroupPending: boolean;
  onAddGroups: () => void;
  addGroupResult: GroupAddBatchResult[] | null;
  addGroupError: string | null;
  removeGroupResult: GroupsRemoveMembersResult | null;
  removedGroupName: string | null;
  onRequestRemoveGroup: (group: ExchangeGroupListItem) => void;
  onClose: () => void;
  recipientDialogPending: boolean;
}

export function RecipientDetailDialog({
  open,
  onOpenChange,
  canDismiss,
  detailTarget,
  detailPending,
  detailError,
  detailResult,
  onRefetchDetails,
  detailCanUpdateCompany,
  updateCompanyName,
  onUpdateCompanyNameChange,
  updatePending,
  onUpdateSubmit,
  updateResult,
  updateError,
  memberSelectionRef,
  membershipsLoading,
  membershipsError,
  currentMemberships,
  onRefetchMemberships,
  allGroupsLoading,
  allGroupsError,
  onRefetchAllGroups,
  availableGroups,
  filteredAvailableGroups,
  groupFilterText,
  onGroupFilterTextChange,
  selectedGroupKeys,
  onToggleGroupSelection,
  onSelectAllFiltered,
  onClearSelection,
  visibleSelectedGroupsCount,
  hasHiddenSelectedGroups,
  selectedGroupsCount,
  addGroupPending,
  onAddGroups,
  addGroupResult,
  addGroupError,
  removeGroupResult,
  removedGroupName,
  onRequestRemoveGroup,
}: RecipientDetailDialogProps) {
  const addGroupIssues = addGroupResult?.flatMap(({ group, result }) =>
    result.items
      .filter((item) => !isAddStatusClean(item.status))
      .map((item) => ({ groupName: group.displayName, status: item.status, detail: item.detail })),
  ) ?? [];
  const addGroupHadIssues = addGroupIssues.length > 0;
  const removeGroupStatus = removeGroupResult?.items[0]?.status ?? null;
  const removeGroupHadIssues = removeGroupStatus ? !isRemoveStatusClean(removeGroupStatus) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[1280px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden text-base"
        showCloseButton={canDismiss}
      >
        {detailTarget && (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <aside className="flex min-h-0 w-80 max-w-80 flex-shrink-0 basis-80 flex-col overflow-hidden border-r border-border/50 bg-muted/30">
              <ScrollArea className="directory-detail-left-pane-scroll directory-detail-pane-scroll min-h-0 flex-1 overflow-hidden">
                <div className="flex min-w-0 max-w-full flex-col gap-4 overflow-hidden p-4">
                  {detailPending ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <Loader2 className="size-6 text-[var(--color-primary)] animate-spin mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Loading details…</p>
                      </div>
                    </div>
                  ) : detailError ? (
                    <div className="flex flex-col items-center gap-3 py-6 text-center">
                      <AlertCircle className="size-8 text-[var(--color-error)]" />
                      <p className="text-sm text-muted-foreground">{detailError}</p>
                      <Button size="sm" onClick={onRefetchDetails}>
                        Retry
                      </Button>
                    </div>
                  ) : detailResult ? (
                    <>
                      {detailResult.mode === "contact" ? (
                        <>
                          <ProfileHeader
                            displayName={detailResult.data.displayName}
                            email={detailResult.data.primaryEmail ?? detailResult.data.alias ?? "\u2014"}
                            badgeClassName={typeBadgeClass("mailContact")}
                            badgeLabel="CONTACT"
                            avatarKey={detailTarget?.stableKey ?? ""}
                          />
                          {detailCanUpdateCompany && (
                            <div className="flex min-w-0 max-w-full flex-col gap-2 overflow-hidden">
                              <div className="min-w-0">
                                <label
                                  htmlFor="contact-company-name"
                                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                                >
                                  Company name
                                </label>
                                <p className="text-xs text-muted-foreground leading-tight">
                                  Update the company value directly.
                                </p>
                              </div>
                              <div className="flex min-w-0 flex-col gap-2">
                                <Input
                                  id="contact-company-name"
                                  className="w-full min-w-0 max-w-full bg-background text-sm"
                                  value={updateCompanyName}
                                  onChange={(e) => onUpdateCompanyNameChange(e.target.value)}
                                  disabled={updatePending}
                                  placeholder="Enter company name"
                                />
                                <Button
                                  size="sm"
                                  className="w-full min-w-0"
                                  disabled={updatePending || updateCompanyName.trim().length === 0}
                                  onClick={onUpdateSubmit}
                                >
                                  {updatePending && <Loader2 className="mr-1 size-3.5 animate-spin" />}
                                  Save Changes
                                </Button>
                              </div>
                              {updateResult && (
                                <p className="text-sm text-emerald-700">
                                  {updateResult.data.verification.detail}
                                </p>
                              )}
                              {updateError && (
                                <p className="text-sm text-[var(--color-error)]">{updateError}</p>
                              )}
                            </div>
                          )}
                          <Separator />
                          <div className="min-w-0 max-w-full divide-y divide-border/50 overflow-hidden rounded-lg border border-border/50 px-3 py-1">
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
                          {detailCanUpdateCompany && (
                            <div className="flex min-w-0 max-w-full flex-col gap-2 overflow-hidden">
                              <div className="min-w-0">
                                <label
                                  htmlFor="guest-company-name"
                                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                                >
                                  Company name
                                </label>
                                <p className="text-xs text-muted-foreground leading-tight">
                                  Update the company value directly.
                                </p>
                              </div>
                              <div className="flex min-w-0 flex-col gap-2">
                                <Input
                                  id="guest-company-name"
                                  className="w-full min-w-0 max-w-full bg-background text-sm"
                                  value={updateCompanyName}
                                  onChange={(e) => onUpdateCompanyNameChange(e.target.value)}
                                  disabled={updatePending}
                                  placeholder="Enter company name"
                                />
                                <Button
                                  size="sm"
                                  className="w-full min-w-0"
                                  disabled={updatePending || updateCompanyName.trim().length === 0}
                                  onClick={onUpdateSubmit}
                                >
                                  {updatePending && <Loader2 className="mr-1 size-3.5 animate-spin" />}
                                  Save Changes
                                </Button>
                              </div>
                              {updateResult && (
                                <p className="text-sm text-emerald-700">
                                  {updateResult.data.verification.detail}
                                </p>
                              )}
                              {updateError && (
                                <p className="text-sm text-[var(--color-error)]">{updateError}</p>
                              )}
                            </div>
                          )}
                          <Separator />
                          <div className="min-w-0 max-w-full divide-y divide-border/50 overflow-hidden rounded-lg border border-border/50 px-3 py-1">
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
                                <span
                                  className={cn(
                                    "text-sm font-medium",
                                    detailResult.data.externalUserState === "Accepted"
                                      ? "text-emerald-700"
                                      : detailResult.data.externalUserState === "PendingAcceptance"
                                        ? "text-amber-700"
                                        : "text-muted-foreground",
                                  )}
                                >
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
                                  <span
                                    className={cn(
                                      "text-sm font-medium",
                                      detailResult.data.accountEnabled ? "text-emerald-700" : "text-red-600",
                                    )}
                                  >
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
                          <Separator />
                          <div className="min-w-0 max-w-full divide-y divide-border/50 overflow-hidden rounded-lg border border-border/50 px-3 py-1">
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
            </aside>

            <section className="w-[400px] flex-shrink-0 flex min-h-0 flex-col overflow-hidden border-r border-border/50 bg-background">
              <div className="flex shrink-0 items-center border-b border-border/50 px-4 py-3">
                <h3 className="text-base font-bold uppercase tracking-wide text-foreground">
                  Current Memberships
                </h3>
              </div>
              <ScrollArea className="directory-detail-pane-scroll min-h-0 flex-1">
                <div className="p-4 flex flex-col gap-4">
                  {membershipsError && (
                    <Alert variant="destructive">
                      <AlertCircle className="size-4" />
                      <AlertTitle>Failed to load memberships</AlertTitle>
                      <AlertDescription>
                        <div className="flex flex-col gap-3">
                          <span>{membershipsError}</span>
                          <div>
                            <Button variant="outline" size="sm" onClick={onRefetchMemberships}>
                              Retry memberships
                            </Button>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {removeGroupResult && removeGroupStatus && (
                    removeGroupHadIssues ? (
                      <Alert variant="destructive">
                        <AlertCircle className="size-4" />
                        <AlertTitle>Remove from group needs attention</AlertTitle>
                        <AlertDescription>
                          {REMOVE_STATUS_LABELS[removeGroupStatus]}: {removeGroupResult.items[0]?.detail ?? "Membership update failed."}
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="flex items-start gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                        <span>
                          {REMOVE_STATUS_LABELS[removeGroupStatus]} — <span className="font-semibold">{removedGroupName ?? "group"}</span>.
                        </span>
                      </div>
                    )
                  )}

                  {!memberSelectionRef ? (
                    <Alert>
                      <AlertTriangle className="size-4" />
                      <AlertTitle>Membership unavailable</AlertTitle>
                      <AlertDescription>
                        This directory entry cannot be resolved into a membership target.
                      </AlertDescription>
                    </Alert>
                  ) : membershipsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="size-8 animate-spin text-[var(--color-primary)]" />
                    </div>
                  ) : (
                    <>
                      {currentMemberships.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">
                          This person is not currently in any groups.
                        </p>
                      ) : (
                        <div className="rounded-sm border border-border/20 bg-background">
                          <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto_3rem] items-center gap-2 border-b border-border/70 bg-muted/95 px-2 py-2 backdrop-blur supports-backdrop-filter:bg-muted/85">
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Group
                            </div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Type
                            </div>
                            <div />
                          </div>
                          <div className="divide-y divide-border/60">
                            {currentMemberships.map((group) => (
                              <div
                                key={group.exchangeIdentity}
                                className="group grid grid-cols-[minmax(0,1fr)_auto_3rem] items-start gap-2 px-2 py-2 transition-colors hover:bg-muted/30"
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-semibold text-foreground">
                                      {group.displayName}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {group.primaryEmail ?? group.exchangeIdentity}
                                    </span>
                                  </div>
                                </div>
                                <div className="pt-0.5">
                                  <Badge variant="outline" className="text-[11px] px-1.5 py-0">
                                    {GROUP_KIND_LABELS[group.groupKind]}
                                  </Badge>
                                </div>
                                <div className="flex justify-end">
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 text-muted-foreground hover:text-[var(--color-error)]"
                                    aria-label={`Remove ${detailTarget.displayName} from ${group.displayName}`}
                                    onClick={() => {
                                      onRequestRemoveGroup(group);
                                    }}
                                  >
                                    <UserMinus className="size-5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>
            </section>

            <section className="min-w-0 flex flex-1 min-h-0 flex-col overflow-hidden bg-background">
              <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-4 py-3">
                <div className="flex flex-col">
                  <h3 className="text-base font-bold uppercase tracking-wide text-foreground">
                    Available Groups
                  </h3>
                </div>
                {selectedGroupsCount > 0 && (
                  <span className="text-sm font-bold text-[var(--color-primary)]">
                    {visibleSelectedGroupsCount} of {selectedGroupsCount} selected
                  </span>
                )}
              </div>
              {memberSelectionRef && !allGroupsLoading && (
                <div className="shrink-0 border-b border-border/50 bg-background px-4 py-3">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground size-3" />
                        <Input
                          className="w-full bg-muted/30 border-border/30 rounded-sm pl-8 pr-3 py-1.5 text-sm"
                          placeholder="Filter available groups..."
                          type="text"
                          value={groupFilterText}
                          onChange={(e) => onGroupFilterTextChange(e.target.value)}
                          disabled={addGroupPending}
                          aria-label="Filter available groups"
                        />
                      </div>
                      <Button
                        size="sm"
                        disabled={visibleSelectedGroupsCount === 0 || addGroupPending}
                        onClick={onAddGroups}
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
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-sm"
                            disabled={addGroupPending || filteredAvailableGroups.every((g) => selectedGroupKeys.has(g.exchangeIdentity))}
                            onClick={onSelectAllFiltered}
                          >
                            Select all filtered
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-sm"
                            disabled={addGroupPending || selectedGroupsCount === 0}
                            onClick={onClearSelection}
                          >
                            Clear selection
                          </Button>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {visibleSelectedGroupsCount} of {filteredAvailableGroups.length} shown
                          {hasHiddenSelectedGroups ? ` \u2022 ${selectedGroupsCount - visibleSelectedGroupsCount} hidden by filter` : ""}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <ScrollArea className="directory-detail-pane-scroll min-h-0 flex-1">
                <div className="p-4 flex flex-col gap-4">
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
                      <div className="flex items-start gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
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
                    <p className="text-sm text-[var(--color-error)]">{addGroupError}</p>
                  )}

                  {allGroupsError && (
                    <Alert variant="destructive">
                      <AlertCircle className="size-4" />
                      <AlertTitle>Failed to load available groups</AlertTitle>
                      <AlertDescription>
                        <div className="flex flex-col gap-3">
                          <span>{allGroupsError}</span>
                          <div>
                            <Button variant="outline" size="sm" onClick={onRefetchAllGroups}>
                              Retry groups list
                            </Button>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {!memberSelectionRef ? (
                    <Alert>
                      <AlertTriangle className="size-4" />
                      <AlertTitle>Membership unavailable</AlertTitle>
                      <AlertDescription>
                        This directory entry cannot be resolved into a membership target.
                      </AlertDescription>
                    </Alert>
                  ) : allGroupsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="size-8 animate-spin text-[var(--color-primary)]" />
                    </div>
                  ) : availableGroups.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2">
                            There are no additional groups available to add.
                          </p>
                        ) : filteredAvailableGroups.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2">
                            No additional groups match the current filter.
                            {hasHiddenSelectedGroups ? " Clear the filter to review hidden selections." : ""}
                          </p>
                        ) : (
                          <div className="rounded-sm border border-border/20 bg-background">
                            <div className="sticky top-0 z-10 grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-border/70 bg-muted/95 px-2 py-2 backdrop-blur supports-backdrop-filter:bg-muted/85">
                              <div />
                              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Group
                              </div>
                              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Type
                              </div>
                            </div>
                            <div className="divide-y divide-border/60">
                              {filteredAvailableGroups.map((group) => {
                                const selected = selectedGroupKeys.has(group.exchangeIdentity);
                                return (
                                  <div
                                    key={group.exchangeIdentity}
                                    className={cn(
                                      "grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-start gap-2 px-2 py-2 transition-colors",
                                      selected ? "bg-primary/5" : "hover:bg-muted/30",
                                    )}
                                  >
                                    <div>
                                      <Checkbox
                                        checked={selected}
                                        onCheckedChange={() => onToggleGroupSelection(group.exchangeIdentity)}
                                        disabled={addGroupPending}
                                        aria-label={`Select ${group.displayName} for group membership add`}
                                      />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-foreground">
                                          {group.displayName}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {group.primaryEmail ?? group.exchangeIdentity}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="pt-0.5">
                                      <Badge variant="outline" className="text-[11px] px-1.5 py-0">
                                        {GROUP_KIND_LABELS[group.groupKind]}
                                      </Badge>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                </div>
              </ScrollArea>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
