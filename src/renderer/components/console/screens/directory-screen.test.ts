import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExchangeRecipientDetails } from '@/shared/contracts/exchange';

const {
  useAppMock,
  useRecipientsSearchQueryMock,
  useContactDetailsQueryMock,
  useGuestDetailsQueryMock,
  useExchangeRecipientDetailsQueryMock,
  useExchangeGroupsQueryMock,
  useAddGroupMembersMutationMock,
  useRemoveGroupMembersMutationMock,
  useGroupMembershipsQueryMock,
  useCreateContactMutationMock,
  useUpdateContactCompanyMutationMock,
  useInviteGuestMutationMock,
  useUpdateGuestCompanyMutationMock,
} = vi.hoisted(() => ({
  useAppMock: vi.fn(),
  useRecipientsSearchQueryMock: vi.fn(),
  useContactDetailsQueryMock: vi.fn(),
  useGuestDetailsQueryMock: vi.fn(),
  useExchangeRecipientDetailsQueryMock: vi.fn(),
  useExchangeGroupsQueryMock: vi.fn(),
  useAddGroupMembersMutationMock: vi.fn(),
  useRemoveGroupMembersMutationMock: vi.fn(),
  useGroupMembershipsQueryMock: vi.fn(),
  useCreateContactMutationMock: vi.fn(),
  useUpdateContactCompanyMutationMock: vi.fn(),
  useInviteGuestMutationMock: vi.fn(),
  useUpdateGuestCompanyMutationMock: vi.fn(),
}));

vi.mock('@/renderer/components/console', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-slot': 'app-shell' }, children),
  TableToolbar: () => React.createElement('div', { 'data-slot': 'table-toolbar' }),
  FilterSegmentedControl: () => React.createElement('div', { 'data-slot': 'filter-segmented-control' }),
}));

vi.mock('@/renderer/components/console/app-context', () => ({
  useApp: useAppMock,
}));

vi.mock('@/renderer/hooks/use-recipients-search', () => ({
  useRecipientsSearchQuery: useRecipientsSearchQueryMock,
}));

vi.mock('@/renderer/hooks/use-contact-details', () => ({
  useContactDetailsQuery: useContactDetailsQueryMock,
}));

vi.mock('@/renderer/hooks/use-guest-details', () => ({
  useGuestDetailsQuery: useGuestDetailsQueryMock,
}));

vi.mock('@/renderer/hooks/use-exchange-recipient-details', () => ({
  useExchangeRecipientDetailsQuery: useExchangeRecipientDetailsQueryMock,
}));

vi.mock('@/renderer/hooks/use-exchange-groups', () => ({
  useExchangeGroupsQuery: useExchangeGroupsQueryMock,
}));

vi.mock('@/renderer/hooks/use-group-member-mutations', () => ({
  useAddGroupMembersMutation: useAddGroupMembersMutationMock,
  useRemoveGroupMembersMutation: useRemoveGroupMembersMutationMock,
}));

vi.mock('@/renderer/hooks/use-group-memberships', () => ({
  useGroupMembershipsQuery: useGroupMembershipsQueryMock,
}));

vi.mock('@/renderer/hooks/use-contact-mutations', () => ({
  useCreateContactMutation: useCreateContactMutationMock,
  useUpdateContactCompanyMutation: useUpdateContactCompanyMutationMock,
}));

vi.mock('@/renderer/hooks/use-guest-mutations', () => ({
  useInviteGuestMutation: useInviteGuestMutationMock,
  useUpdateGuestCompanyMutation: useUpdateGuestCompanyMutationMock,
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
  Button: ({ children }: { children: React.ReactNode }) =>
    React.createElement('button', { type: 'button' }, children),
}));

vi.mock('@/renderer/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => React.createElement('span', null, children),
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
  TableRow: ({ children }: { children: React.ReactNode }) => React.createElement('tr', null, children),
}));

vi.mock('@/renderer/components/ui/input', () => ({
  Input: () => React.createElement('input'),
}));

vi.mock('@/renderer/components/ui/checkbox', () => ({
  Checkbox: () => React.createElement('div', { 'data-slot': 'checkbox' }),
}));

vi.mock('@/renderer/components/ui/alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  AlertTitle: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  AlertDescription: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

vi.mock('@/renderer/components/ui/separator', () => ({
  Separator: () => React.createElement('hr'),
}));

import { DirectoryScreen } from './directory-screen';

function makeExchangeDetail(recipientType: 'mailbox' | 'mailUser'): ExchangeRecipientDetails {
  return {
    exchangeIdentity:
      recipientType === 'mailUser' ? 'jane.external@example.com' : 'shared@example.com',
    objectId: `recipient-${recipientType}`,
    primaryEmail:
      recipientType === 'mailUser' ? 'jane@yourcompany.com' : 'shared@example.com',
    externalEmailAddress: recipientType === 'mailUser' ? 'jane@gmail.com' : null,
    displayName: recipientType === 'mailUser' ? 'Jane External' : 'Shared Mailbox',
    alias: recipientType === 'mailUser' ? 'jexternal' : 'shared-mailbox',
    companyName: 'Example Corp',
    firstName: recipientType === 'mailUser' ? 'Jane' : null,
    lastName: recipientType === 'mailUser' ? 'External' : null,
    title: recipientType === 'mailUser' ? 'Director' : null,
    department: recipientType === 'mailUser' ? 'Operations' : null,
    phone: recipientType === 'mailUser' ? '+1 555-0100' : null,
    office: recipientType === 'mailUser' ? 'HQ-201' : null,
    userPrincipalName:
      recipientType === 'mailUser'
        ? 'jane_external#EXT#@tenant.onmicrosoft.com'
        : 'shared@example.com',
    recipientType,
    recipientTypeDetails: recipientType === 'mailUser' ? 'MailUser' : 'SharedMailbox',
  };
}

const defaultSearchQueryResult = {
  results: null,
  isLoading: false,
  isFetching: false,
  error: null,
  errorPresentation: null,
  refetch: vi.fn(() => Promise.resolve(undefined)),
};

const defaultContactDetailsQueryResult = {
  contact: null,
  isLoading: false,
  isFetching: false,
  error: null,
  errorPresentation: null,
  refetch: vi.fn(() => Promise.resolve(undefined)),
};

const defaultGuestDetailsQueryResult = {
  guest: null,
  isLoading: false,
  isFetching: false,
  error: null,
  errorPresentation: null,
  refetch: vi.fn(() => Promise.resolve(undefined)),
};

const defaultExchangeRecipientDetailsQueryResult = {
  recipient: null,
  isLoading: false,
  isFetching: false,
  error: null,
  errorPresentation: null,
  refetch: vi.fn(() => Promise.resolve(undefined)),
};

const defaultExchangeGroupsQueryResult = {
  groups: [],
  appliedKind: 'all',
  isLoading: false,
  isFetching: false,
  error: null,
  errorPresentation: null,
  refetch: vi.fn(() => Promise.resolve(undefined)),
};

const defaultGroupMembershipsQueryResult = {
  member: null,
  groups: [],
  isLoading: false,
  isFetching: false,
  error: null,
  errorPresentation: null,
  hasData: false,
  refetch: vi.fn(() => Promise.resolve(undefined)),
};

describe('DirectoryScreen exchange recipient details', () => {
  beforeEach(() => {
    useAppMock.mockReset();
    useRecipientsSearchQueryMock.mockReset();
    useContactDetailsQueryMock.mockReset();
    useGuestDetailsQueryMock.mockReset();
    useExchangeRecipientDetailsQueryMock.mockReset();
    useExchangeGroupsQueryMock.mockReset();
    useAddGroupMembersMutationMock.mockReset();
    useRemoveGroupMembersMutationMock.mockReset();
    useGroupMembershipsQueryMock.mockReset();
    useCreateContactMutationMock.mockReset();
    useUpdateContactCompanyMutationMock.mockReset();
    useInviteGuestMutationMock.mockReset();
    useUpdateGuestCompanyMutationMock.mockReset();

    useAppMock.mockReturnValue({
      shell: {
        session: null,
        exchangeCapabilities: null,
        graphConnection: {
          state: 'connected',
          detail: 'Connected',
          authMethod: 'interactiveBrowser',
          configuredTenantId: 'tenant-1',
          tenantId: 'tenant-1',
          tenantDisplayName: 'Tenant',
          accountUsername: 'graph-admin@example.com',
          accountDisplayName: 'Graph Admin',
          tokenExpiresOnUtc: null,
          exchangeAlignment: 'matched',
        },
        exchangeConnection: {
          state: 'connected',
          detail: 'Connected',
          runtime: null,
          userPrincipalName: 'exchange-admin@example.com',
          connectionId: 'connection-1',
          tenantId: 'tenant-1',
          tokenStatus: 'Active',
          tokenExpiryTimeUtc: null,
          connectedAtUtc: null,
        },
        isHydrating: false,
        loadError: null,
      },
      directoryScreenState: {
        activeTab: 'all',
        searchText: '',
        effectiveQuery: '',
      },
      setDirectoryScreenState: vi.fn(),
    });

    useRecipientsSearchQueryMock.mockReturnValue({ ...defaultSearchQueryResult });
    useContactDetailsQueryMock.mockReturnValue({ ...defaultContactDetailsQueryResult });
    useGuestDetailsQueryMock.mockReturnValue({ ...defaultGuestDetailsQueryResult });
    useExchangeRecipientDetailsQueryMock.mockReturnValue({ ...defaultExchangeRecipientDetailsQueryResult });
    useExchangeGroupsQueryMock.mockReturnValue({ ...defaultExchangeGroupsQueryResult });
    useAddGroupMembersMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
    useRemoveGroupMembersMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
    useGroupMembershipsQueryMock.mockReturnValue({ ...defaultGroupMembershipsQueryResult });
    useCreateContactMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
    useUpdateContactCompanyMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
    useInviteGuestMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
    useUpdateGuestCompanyMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
  });

  it('queries exchange recipient details for directory detail reads', () => {
    const detailData = makeExchangeDetail('mailUser');

    useExchangeRecipientDetailsQueryMock.mockReturnValue({
      ...defaultExchangeRecipientDetailsQueryResult,
      recipient: detailData,
    });

    renderToStaticMarkup(React.createElement(DirectoryScreen));

    expect(useExchangeRecipientDetailsQueryMock).toHaveBeenCalled();
  });

  it('queries mailbox details through the exchange recipient hook', () => {
    const detailData = makeExchangeDetail('mailbox');

    useExchangeRecipientDetailsQueryMock.mockReturnValue({
      ...defaultExchangeRecipientDetailsQueryResult,
      recipient: detailData,
    });

    renderToStaticMarkup(React.createElement(DirectoryScreen));

    expect(useExchangeRecipientDetailsQueryMock).toHaveBeenCalled();
  });

  it('passes scoped identities and shell connections to the query hooks', () => {
    renderToStaticMarkup(React.createElement(DirectoryScreen));

    expect(useRecipientsSearchQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('connected:tenant-1:connection-1:exchange-admin@example.com'),
      expect.any(String),
      expect.any(Array),
      expect.any(Boolean),
    );

    expect(useContactDetailsQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'connected',
        tenantId: 'tenant-1',
        connectionId: 'connection-1',
        userPrincipalName: 'exchange-admin@example.com',
      }),
      undefined,
      false,
    );

    expect(useGuestDetailsQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'connected',
        tenantId: 'tenant-1',
        configuredTenantId: 'tenant-1',
        accountUsername: 'graph-admin@example.com',
      }),
      undefined,
      false,
    );

    expect(useExchangeRecipientDetailsQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'connected',
        tenantId: 'tenant-1',
        connectionId: 'connection-1',
        userPrincipalName: 'exchange-admin@example.com',
      }),
      undefined,
      false,
    );

    expect(useCreateContactMutationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'connected',
        tenantId: 'tenant-1',
        connectionId: 'connection-1',
        userPrincipalName: 'exchange-admin@example.com',
      }),
      expect.objectContaining({
        state: 'connected',
        tenantId: 'tenant-1',
        configuredTenantId: 'tenant-1',
        accountUsername: 'graph-admin@example.com',
      }),
    );

    expect(useUpdateContactCompanyMutationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'connected',
        tenantId: 'tenant-1',
        connectionId: 'connection-1',
        userPrincipalName: 'exchange-admin@example.com',
      }),
      expect.objectContaining({
        state: 'connected',
        tenantId: 'tenant-1',
        configuredTenantId: 'tenant-1',
        accountUsername: 'graph-admin@example.com',
      }),
    );

    expect(useInviteGuestMutationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'connected',
        tenantId: 'tenant-1',
        connectionId: 'connection-1',
        userPrincipalName: 'exchange-admin@example.com',
      }),
      expect.objectContaining({
        state: 'connected',
        tenantId: 'tenant-1',
        configuredTenantId: 'tenant-1',
        accountUsername: 'graph-admin@example.com',
      }),
    );

    expect(useUpdateGuestCompanyMutationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'connected',
        tenantId: 'tenant-1',
        connectionId: 'connection-1',
        userPrincipalName: 'exchange-admin@example.com',
      }),
      expect.objectContaining({
        state: 'connected',
        tenantId: 'tenant-1',
        configuredTenantId: 'tenant-1',
        accountUsername: 'graph-admin@example.com',
      }),
    );
  });

  it('disables search query when connection is gated', () => {
    useAppMock.mockReturnValue({
      shell: {
        session: null,
        exchangeCapabilities: null,
        graphConnection: null,
        exchangeConnection: {
          state: 'disconnected',
          detail: 'Not connected',
          runtime: null,
          userPrincipalName: null,
          connectionId: null,
          tenantId: null,
          tokenStatus: null,
          tokenExpiryTimeUtc: null,
          connectedAtUtc: null,
        },
        isHydrating: false,
        loadError: null,
      },
      directoryScreenState: {
        activeTab: 'all',
        searchText: '',
        effectiveQuery: '',
      },
      setDirectoryScreenState: vi.fn(),
    });

    renderToStaticMarkup(React.createElement(DirectoryScreen));

    // When disconnected, the search query should receive empty types (disabled)
    const searchCall = useRecipientsSearchQueryMock.mock.calls[0];
    expect(searchCall[1]).toBe('');
    expect(searchCall[2]).toEqual([]);
  });
});
