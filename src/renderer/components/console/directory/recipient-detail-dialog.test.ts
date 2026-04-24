import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ExchangeGroupListItem,
  GroupMemberSelectionRef,
} from '@/shared/contracts/exchange';
import type { ContactDetails } from '@/shared/contracts/contacts';
import type { GuestDetails } from '@/shared/contracts/guests';
import type { ExchangeRecipientDetails, GroupsRemoveMembersResult } from '@/shared/contracts/exchange';
import type { RecipientSearchItem } from '@/shared/contracts/recipients';

const { checkboxProps, tableRowProps } = vi.hoisted(() => ({
  checkboxProps: [] as Array<{ onCheckedChange?: (() => void) | undefined }>,
  tableRowProps: [] as Array<{ onClick?: (() => void) | undefined }>,
}));

vi.mock('@/renderer/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) =>
    open ? React.createElement('div', { 'data-slot': 'dialog' }, children) : null,
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-slot': 'dialog-content' }, children),
  DialogDescription: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  DialogFooter: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

vi.mock('@/renderer/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ComponentProps<'button'>) =>
    React.createElement('button', { type: 'button', ...props }, children),
}));

vi.mock('@/renderer/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.ComponentProps<'span'>) =>
    React.createElement('span', props, children),
}));

vi.mock('@/renderer/components/ui/avatar', () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  AvatarFallback: ({ children }: { children: React.ReactNode }) => React.createElement('span', null, children),
}));

vi.mock('@/renderer/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => React.createElement('table', null, children),
  TableBody: ({ children }: { children: React.ReactNode }) => React.createElement('tbody', null, children),
  TableCell: ({ children }: { children: React.ReactNode }) => React.createElement('td', null, children),
  TableHead: ({ children }: { children: React.ReactNode }) => React.createElement('th', null, children),
  TableHeader: ({ children }: { children: React.ReactNode }) => React.createElement('thead', null, children),
  TableRow: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => {
    tableRowProps.push({ onClick });
    return React.createElement('tr', null, children);
  },
}));

vi.mock('@/renderer/components/ui/input', () => ({
  Input: (props: React.ComponentProps<'input'>) => React.createElement('input', props),
}));

vi.mock('@/renderer/components/ui/checkbox', () => ({
  Checkbox: ({ onCheckedChange }: { onCheckedChange?: () => void }) => {
    checkboxProps.push({ onCheckedChange });
    return React.createElement('div', { 'data-slot': 'checkbox' });
  },
}));

vi.mock('@/renderer/components/ui/alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  AlertTitle: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  AlertDescription: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

vi.mock('@/renderer/components/ui/separator', () => ({
  Separator: () => React.createElement('hr'),
}));

vi.mock('@/renderer/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: React.ComponentProps<'div'>) =>
    React.createElement('div', props, children),
}));

import { RecipientDetailDialog } from './recipient-detail-dialog';

function makeContactDetails(): ContactDetails {
  return {
    exchangeIdentity: 'contact@example.com',
    objectId: null,
    primaryEmail: 'contact@example.com',
    displayName: 'Test Contact',
    alias: 'tcontact',
    companyName: 'Test Corp',
    firstName: 'Test',
    lastName: 'Contact',
    title: 'Engineer',
    department: 'Engineering',
    phone: '+1 555-0100',
    office: 'HQ-101',
    streetAddress: '123 Main St',
    city: 'Seattle',
    stateOrProvince: 'WA',
    postalCode: '98101',
    countryOrRegion: 'US',
    recipientTypeDetails: 'MailContact',
  };
}

function makeGuestDetails(): GuestDetails {
  return {
    stableKey: 'guest-1',
    objectId: 'guest-obj-1',
    displayName: 'Test Guest',
    primaryEmail: 'guest@example.com',
    userPrincipalName: 'guest_example.com#EXT#@tenant.onmicrosoft.com',
    companyName: 'Guest Corp',
    externalUserState: 'PendingAcceptance',
    givenName: 'Test',
    surname: 'Guest',
    jobTitle: 'Consultant',
    department: 'External',
    mobilePhone: '+1 555-0200',
    officeLocation: 'Remote',
    preferredLanguage: 'en-US',
    createdDateTime: '2024-01-15T10:00:00Z',
    accountEnabled: true,
  };
}

function makeExchangeRecipientDetails(): ExchangeRecipientDetails {
  return {
    exchangeIdentity: 'shared@example.com',
    objectId: 'recipient-1',
    primaryEmail: 'shared@example.com',
    externalEmailAddress: null,
    displayName: 'Shared Mailbox',
    alias: 'shared',
    companyName: 'Example Corp',
    firstName: null,
    lastName: null,
    title: null,
    department: null,
    phone: null,
    office: null,
    userPrincipalName: 'shared@example.com',
    recipientType: 'mailbox',
    recipientTypeDetails: 'SharedMailbox',
  };
}

function makeGroup(overrides?: Partial<ExchangeGroupListItem>): ExchangeGroupListItem {
  return {
    objectId: 'group-1',
    exchangeIdentity: 'group1@example.com',
    displayName: 'Test Group',
    alias: 'tgroup',
    primaryEmail: 'group1@example.com',
    groupKind: 'distributionList',
    managedByDisplayNames: [],
    whenChangedUtc: null,
    ...overrides,
  };
}

function makeRemoveResult(
  status: GroupsRemoveMembersResult['items'][number]['status'],
  detail = 'Verification failed.',
): GroupsRemoveMembersResult {
  return {
    group: {
      exchangeIdentity: 'group-1@example.com',
      objectId: 'group-1',
      groupKind: 'distributionList',
    },
    summary: {
      requested: 1,
      removed: status === 'removed' ? 1 : 0,
      notMember: status === 'notMember' ? 1 : 0,
      invalid: status === 'invalid' ? 1 : 0,
      verificationFailed: status === 'verificationFailed' ? 1 : 0,
      failed: status === 'failed' ? 1 : 0,
    },
    items: [
      {
        member: {
          exchangeIdentity: 'contact@example.com',
          objectId: null,
          primaryEmail: 'contact@example.com',
        },
        status,
        detail,
      },
    ],
    verification: {
      attempted: true,
      verifiedRemoved: status === 'removed' ? 1 : 0,
      detail,
    },
  };
}

function makeDetailTarget(overrides?: Partial<RecipientSearchItem>): RecipientSearchItem {
  return {
    source: 'exchange',
    stableKey: 'test-1',
    recipientType: 'mailContact',
    membershipSupport: 'exchangeDirect',
    objectId: null,
    exchangeIdentity: 'contact@example.com',
    primaryEmail: 'contact@example.com',
    displayName: 'Test Contact',
    alias: 'tcontact',
    recipientTypeDetails: 'MailContact',
    companyName: 'Test Corp',
    companySource: 'exchange',
    ...overrides,
  };
}

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  canDismiss: true,
  detailTarget: makeDetailTarget(),
  detailPending: false,
  detailError: null,
  detailResult: { mode: 'contact' as const, data: makeContactDetails() },
  onRefetchDetails: vi.fn(),
  detailCanUpdateCompany: true,
  updateCompanyName: 'Test Corp',
  onUpdateCompanyNameChange: vi.fn(),
  updatePending: false,
  onUpdateSubmit: vi.fn(),
  updateResult: null,
  updateError: null,
  memberSelectionRef: {
    kind: 'exchangeRecipient' as const,
    exchangeIdentity: 'contact@example.com',
    objectId: null,
    primaryEmail: 'contact@example.com',
    displayName: 'Test Contact',
  } satisfies GroupMemberSelectionRef,
  membershipsLoading: false,
  membershipsError: null,
  currentMemberships: [makeGroup()],
  onRefetchMemberships: vi.fn(),
  allGroupsLoading: false,
  allGroupsError: null,
  onRefetchAllGroups: vi.fn(),
  availableGroups: [makeGroup({ exchangeIdentity: 'group2@example.com', primaryEmail: 'group2@example.com', displayName: 'Another Group' })],
  filteredAvailableGroups: [makeGroup({ exchangeIdentity: 'group2@example.com', primaryEmail: 'group2@example.com', displayName: 'Another Group' })],
  groupFilterText: '',
  onGroupFilterTextChange: vi.fn(),
  selectedGroupKeys: new Set<string>(),
  onToggleGroupSelection: vi.fn(),
  onSelectAllFiltered: vi.fn(),
  onClearSelection: vi.fn(),
  visibleSelectedGroupsCount: 0,
  hasHiddenSelectedGroups: false,
  selectedGroupsCount: 0,
  addGroupPending: false,
  onAddGroups: vi.fn(),
  addGroupResult: null,
  addGroupError: null,
  removeGroupResult: null,
  removedGroupName: null,
  onRequestRemoveGroup: vi.fn(),
  onClose: vi.fn(),
  recipientDialogPending: false,
};

describe('RecipientDetailDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkboxProps.length = 0;
    tableRowProps.length = 0;
  });

  it('renders contact details in left pane', () => {
    const markup = renderToStaticMarkup(React.createElement(RecipientDetailDialog, defaultProps));
    expect(markup).toContain('Test Contact');
    expect(markup).toContain('contact@example.com');
    expect(markup).toContain('Engineer');
    expect(markup).toContain('Engineering');
    expect(markup).toContain('HQ-101');
    expect(markup).toContain('123 Main St');
    expect(markup).toContain('Seattle');
    expect(markup).toContain('WA');
    expect(markup).toContain('98101');
    expect(markup).toContain('US');
  });

  it('keeps long contact details constrained inside the shared left pane', () => {
    const longEmail = 'very.long.personal.email.address.with.no.breaks@example-very-long-domain-name.test';
    const longCompany = 'ExtremelyLongCompanyNameWithoutNaturalBreaksThatPreviouslyForcedThePaneWider';
    const props = {
      ...defaultProps,
      updateCompanyName: longCompany,
      detailTarget: makeDetailTarget({
        primaryEmail: longEmail,
        alias: 'VeryLongAliasWithoutAnyNaturalBreakpoints',
        companyName: longCompany,
      }),
      detailResult: {
        mode: 'contact' as const,
        data: {
          ...makeContactDetails(),
          primaryEmail: longEmail,
          alias: 'VeryLongAliasWithoutAnyNaturalBreakpoints',
          companyName: longCompany,
        },
      },
    };

    const markup = renderToStaticMarkup(React.createElement(RecipientDetailDialog, props));

    expect(markup).toContain(longEmail);
    expect(markup).toContain(longCompany);
    expect(markup).toContain('directory-detail-left-pane-scroll');
    expect(markup).toContain('[overflow-wrap:anywhere]');
    expect(markup).toContain('w-full min-w-0 max-w-full');
    expect(markup).toContain('overflow-hidden rounded-lg border');
  });

  it('renders guest details in left pane', () => {
    const props = {
      ...defaultProps,
      detailTarget: makeDetailTarget({
        stableKey: 'guest-1',
        recipientType: 'guestUser',
        displayName: 'Test Guest',
        primaryEmail: 'guest@example.com',
        alias: null,
        recipientTypeDetails: null,
        companyName: 'Guest Corp',
        source: 'graph',
        membershipSupport: 'graphBridgeable',
        exchangeIdentity: null,
        objectId: 'guest-obj-1',
        companySource: 'graph',
      }),
      detailResult: { mode: 'guest' as const, data: makeGuestDetails() },
      memberSelectionRef: {
        kind: 'graphGuest' as const,
        objectId: 'guest-obj-1',
        primaryEmail: 'guest@example.com',
        displayName: 'Test Guest',
      } satisfies GroupMemberSelectionRef,
    };
    const markup = renderToStaticMarkup(React.createElement(RecipientDetailDialog, props));
    expect(markup).toContain('Test Guest');
    expect(markup).toContain('guest@example.com');
    expect(markup).toContain('Consultant');
    expect(markup).toContain('External');
    expect(markup).toContain('Remote');
    expect(markup).toContain('en-US');
    expect(markup).toContain('Pending Acceptance');
    expect(markup).toContain('Yes');
  });

  it('keeps long guest UPN values wrapped inside the shared left pane', () => {
    const longUpn =
      'guest.user.with.a.very.long.external.identifier_example.com#EXT#@very-long-tenant-name.onmicrosoft.com';
    const props = {
      ...defaultProps,
      detailTarget: makeDetailTarget({
        stableKey: 'guest-1',
        recipientType: 'guestUser',
        displayName: 'Long Guest User',
        primaryEmail: null,
        alias: null,
        recipientTypeDetails: null,
        companyName: 'Guest Corp',
        source: 'graph',
        membershipSupport: 'graphBridgeable',
        exchangeIdentity: null,
        objectId: 'guest-obj-1',
        companySource: 'graph',
      }),
      detailResult: {
        mode: 'guest' as const,
        data: {
          ...makeGuestDetails(),
          displayName: 'Long Guest User',
          primaryEmail: null,
          userPrincipalName: longUpn,
        },
      },
      memberSelectionRef: {
        kind: 'graphGuest' as const,
        objectId: 'guest-obj-1',
        primaryEmail: null,
        displayName: 'Long Guest User',
      } satisfies GroupMemberSelectionRef,
    };

    const markup = renderToStaticMarkup(React.createElement(RecipientDetailDialog, props));

    expect(markup).toContain(longUpn);
    expect(markup).toContain('[overflow-wrap:anywhere]');
    expect(markup).toContain('min-w-0 max-w-full');
  });

  it('renders exchange recipient details in left pane', () => {
    const props = {
      ...defaultProps,
      detailTarget: makeDetailTarget({
        stableKey: 'recipient-1',
        recipientType: 'mailbox',
        displayName: 'Shared Mailbox',
        primaryEmail: 'shared@example.com',
        alias: 'shared',
        recipientTypeDetails: 'SharedMailbox',
        companyName: 'Example Corp',
        source: 'exchange',
        membershipSupport: 'exchangeDirect',
        exchangeIdentity: 'shared@example.com',
        objectId: 'recipient-1',
      }),
      detailResult: { mode: 'exchangeRecipient' as const, data: makeExchangeRecipientDetails() },
    };
    const markup = renderToStaticMarkup(React.createElement(RecipientDetailDialog, props));
    expect(markup).toContain('Shared Mailbox');
    expect(markup).toContain('shared@example.com');
    expect(markup).toContain('SharedMailbox');
  });

  it('renders current groups table in right pane', () => {
    const markup = renderToStaticMarkup(React.createElement(RecipientDetailDialog, defaultProps));
    expect(markup).toContain('Current Memberships');
    expect(markup).toContain('Test Group');
    expect(markup).toContain('group1@example.com');
  });

  it('renders add to groups section with filter and table', () => {
    const markup = renderToStaticMarkup(React.createElement(RecipientDetailDialog, defaultProps));
    expect(markup).toContain('Available Groups');
    expect(markup).toContain('Another Group');
    expect(markup).toContain('group2@example.com');
  });

  it('shows company update when detailCanUpdateCompany is true', () => {
    const markup = renderToStaticMarkup(React.createElement(RecipientDetailDialog, defaultProps));
    expect(markup).toContain('Company name');
    expect(markup).toContain('Save Changes');
  });

  it('hides company update when detailCanUpdateCompany is false', () => {
    const props = { ...defaultProps, detailCanUpdateCompany: false };
    const markup = renderToStaticMarkup(React.createElement(RecipientDetailDialog, props));
    expect(markup).not.toContain('Save Changes');
  });

  it('shows loading state when detailPending is true', () => {
    const props = { ...defaultProps, detailPending: true, detailResult: null };
    const markup = renderToStaticMarkup(React.createElement(RecipientDetailDialog, props));
    expect(markup).toContain('Loading details');
  });

  it('shows error state when detailError is present', () => {
    const props = { ...defaultProps, detailError: 'Failed to load', detailResult: null };
    const markup = renderToStaticMarkup(React.createElement(RecipientDetailDialog, props));
    expect(markup).toContain('Failed to load');
    expect(markup).toContain('Retry');
  });

  it('shows membership unavailable when memberSelectionRef is null', () => {
    const props = { ...defaultProps, memberSelectionRef: null };
    const markup = renderToStaticMarkup(React.createElement(RecipientDetailDialog, props));
    expect(markup).toContain('Membership unavailable');
  });

  it('shows empty current groups message when there are no memberships', () => {
    const props = { ...defaultProps, currentMemberships: [] };
    const markup = renderToStaticMarkup(React.createElement(RecipientDetailDialog, props));
    expect(markup).toContain('not currently in any groups');
  });

  it('shows no available groups message when availableGroups is empty', () => {
    const props = { ...defaultProps, availableGroups: [], filteredAvailableGroups: [] };
    const markup = renderToStaticMarkup(React.createElement(RecipientDetailDialog, props));
    expect(markup).toContain('no additional groups available');
  });

  it('does not attach row-level click handlers to available-groups table rows', () => {
    renderToStaticMarkup(React.createElement(RecipientDetailDialog, defaultProps));
    expect(tableRowProps.every((props) => props.onClick === undefined)).toBe(true);
    expect(checkboxProps.some((props) => typeof props.onCheckedChange === 'function')).toBe(true);
  });

  it('renders remove-group attention feedback for resolved unsuccessful outcomes', () => {
    const props = {
      ...defaultProps,
      removeGroupResult: makeRemoveResult('verificationFailed'),
    };
    const markup = renderToStaticMarkup(React.createElement(RecipientDetailDialog, props));
    expect(markup).toContain('Remove from group needs attention');
    expect(markup).toContain('Verification failed');
  });

  it('provides an accessible label for current-group remove actions', () => {
    const markup = renderToStaticMarkup(React.createElement(RecipientDetailDialog, defaultProps));
    expect(markup).toContain('aria-label="Remove Test Contact from Test Group"');
  });

  it('reveals current-group remove actions on focus as well as hover', () => {
    const markup = renderToStaticMarkup(React.createElement(RecipientDetailDialog, defaultProps));
    expect(markup).toContain('group-focus-within:opacity-100');
    expect(markup).toContain('focus-visible:opacity-100');
  });
});
