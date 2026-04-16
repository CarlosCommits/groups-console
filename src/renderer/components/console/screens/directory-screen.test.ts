import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExchangeRecipientDetails } from '@/shared/contracts/exchange';
import type { RecipientSearchItem } from '@/shared/contracts/recipients';

const { useAppMock, useEffectMock, useStateMock } = vi.hoisted(() => ({
  useAppMock: vi.fn(),
  useEffectMock: vi.fn(),
  useStateMock: vi.fn(),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useEffect: useEffectMock,
    useState: useStateMock,
  };
});

vi.mock('@/renderer/components/console', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-slot': 'app-shell' }, children),
  TableToolbar: () => React.createElement('div', { 'data-slot': 'table-toolbar' }),
  FilterSegmentedControl: () => React.createElement('div', { 'data-slot': 'filter-segmented-control' }),
  TableFilterButton: () => React.createElement('button', { type: 'button' }, 'Filters'),
}));

vi.mock('@/renderer/components/console/app-context', () => ({
  useApp: useAppMock,
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

function makeDetailTarget(recipientType: 'mailbox' | 'mailUser'): RecipientSearchItem {
  return {
    source: 'exchange',
    stableKey: `exchange:objectId:${recipientType}`,
    recipientType,
    membershipSupport: 'exchangeDirect',
    objectId: `recipient-${recipientType}`,
    exchangeIdentity:
      recipientType === 'mailUser' ? 'jane.external@example.com' : 'shared@example.com',
    primaryEmail:
      recipientType === 'mailUser' ? 'jane@yourcompany.com' : 'shared@example.com',
    displayName: recipientType === 'mailUser' ? 'Jane External' : 'Shared Mailbox',
    alias: recipientType === 'mailUser' ? 'jexternal' : 'shared-mailbox',
    recipientTypeDetails: recipientType === 'mailUser' ? 'MailUser' : 'SharedMailbox',
    companyName: 'Example Corp',
    companySource: 'exchange',
  };
}

function makeExchangeDetail(recipientType: 'mailbox' | 'mailUser'): ExchangeRecipientDetails {
  return {
    exchangeIdentity:
      recipientType === 'mailUser' ? 'jane.external@example.com' : 'shared@example.com',
    objectId: `recipient-${recipientType}`,
    primaryEmail:
      recipientType === 'mailUser' ? 'jane@yourcompany.com' : 'shared@example.com',
    externalEmailAddress: recipientType === 'mailUser' ? 'jane.personal@example.com' : null,
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

function primeDirectoryState(recipientType: 'mailbox' | 'mailUser') {
  const setState = vi.fn();
  const detailTarget = makeDetailTarget(recipientType);
  const detailResult = {
    mode: 'exchangeRecipient' as const,
    data: makeExchangeDetail(recipientType),
  };

  const stateValues = [
    'all',
    '',
    '',
    null,
    false,
    null,
    false,
    'contact',
    '',
    '',
    '',
    '',
    true,
    false,
    null,
    null,
    false,
    null,
    '',
    false,
    null,
    null,
    true,
    detailTarget,
    false,
    detailResult,
    null,
  ];

  useStateMock.mockReset();
  stateValues.forEach((value) => {
    useStateMock.mockImplementationOnce(() => [value, setState]);
  });
}

describe('DirectoryScreen exchange recipient details', () => {
  beforeEach(() => {
    useEffectMock.mockReset();
    useEffectMock.mockImplementation(() => undefined);
    useAppMock.mockReset();
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
    });
  });

  it('shows both Email and External Target for mail users', () => {
    primeDirectoryState('mailUser');

    const markup = renderToStaticMarkup(React.createElement(DirectoryScreen));

    expect(markup).toContain('Mail User Details');
    expect(markup).toContain('Email');
    expect(markup).toContain('External Target');
    expect(markup).toContain('jane@yourcompany.com');
    expect(markup).toContain('jane.personal@example.com');
  });

  it('shows only Email for mailbox details', () => {
    primeDirectoryState('mailbox');

    const markup = renderToStaticMarkup(React.createElement(DirectoryScreen));

    expect(markup).toContain('Mailbox Details');
    expect(markup).toContain('Email');
    expect(markup).toContain('shared@example.com');
    expect(markup).not.toContain('External Target');
  });
});
