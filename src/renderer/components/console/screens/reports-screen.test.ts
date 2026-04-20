import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useAppMock, useExchangeGroupsQueryMock, buttonProps } = vi.hoisted(() => ({
  useAppMock: vi.fn(),
  useExchangeGroupsQueryMock: vi.fn(),
  buttonProps: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/renderer/components/console', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-slot': 'app-shell' }, children),
  PageHeader: ({ children, actions, title, description }: {
    children?: React.ReactNode;
    actions?: React.ReactNode;
    title: string;
    description?: string;
  }) => React.createElement('div', { 'data-slot': 'page-header' }, title, description, actions, children),
  StatusBadge: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('span', null, children),
}));

vi.mock('@/renderer/components/console/app-context', () => ({
  useApp: useAppMock,
}));

vi.mock('@/renderer/hooks/use-exchange-groups', () => ({
  useExchangeGroupsQuery: useExchangeGroupsQueryMock,
}));

vi.mock('@/renderer/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => React.createElement('table', null, children),
  TableBody: ({ children }: { children: React.ReactNode }) => React.createElement('tbody', null, children),
  TableCell: ({ children }: { children: React.ReactNode }) => React.createElement('td', null, children),
  TableHead: ({ children }: { children: React.ReactNode }) => React.createElement('th', null, children),
  TableHeader: ({ children }: { children: React.ReactNode }) => React.createElement('thead', null, children),
  TableRow: ({ children }: { children: React.ReactNode }) => React.createElement('tr', null, children),
}));

vi.mock('@/renderer/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => React.createElement('section', null, children),
  CardHeader: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  CardTitle: ({ children }: { children: React.ReactNode }) => React.createElement('h2', null, children),
  CardContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

vi.mock('@/renderer/components/ui/button', () => ({
  Button: (props: { children: React.ReactNode }) => {
    buttonProps.push(props as Record<string, unknown>);
    return React.createElement('button', { type: 'button' }, props.children);
  },
}));

vi.mock('@/renderer/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  SelectContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  SelectGroup: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  SelectItem: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => React.createElement('button', { type: 'button' }, children),
  SelectValue: () => React.createElement('span', null, 'Selected'),
}));

vi.mock('@/renderer/components/ui/progress', () => ({
  Progress: ({ value }: { value?: number }) => React.createElement('div', null, `Progress:${value ?? 0}`),
}));

import { ReportsScreen } from './reports-screen';

function getTextContent(value: React.ReactNode): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(getTextContent).join('');
  }
  if (React.isValidElement<{ children?: React.ReactNode }>(value)) {
    return getTextContent(value.props.children);
  }
  return '';
}

const connectedShell = {
  session: null,
  exchangeCapabilities: null,
  graphConnection: null,
  exchangeConnection: {
    state: 'connected',
    detail: 'Connected',
    runtime: null,
    userPrincipalName: 'admin@example.com',
    connectionId: 'connection-1',
    tenantId: 'tenant-1',
    tokenStatus: null,
    tokenExpiryTimeUtc: null,
    connectedAtUtc: null,
  },
  isHydrating: false,
  loadError: null,
};

const groupsQueryResult = {
  groups: [
    {
      exchangeIdentity: 'all-staff',
      objectId: 'group-1',
      groupKind: 'distributionList' as const,
      displayName: 'All Staff',
      primaryEmail: 'allstaff@example.com',
    },
  ],
  appliedKind: 'all' as const,
  isLoading: false,
  error: null,
  refetch: vi.fn(async () => undefined),
};

describe('ReportsScreen membership matrix states', () => {
  beforeEach(() => {
    useExchangeGroupsQueryMock.mockReset();
    useAppMock.mockReset();
    buttonProps.length = 0;

    useExchangeGroupsQueryMock.mockReturnValue(groupsQueryResult);
    useAppMock.mockReturnValue({
      shell: connectedShell,
      membershipMatrixGeneration: {
        requestedKind: null,
        phase: 'idle',
        progressMessage: '',
        progressPercent: 0,
        result: null,
        error: null,
      },
      generateMembershipMatrix: vi.fn(async () => undefined),
      clearMembershipMatrixGeneration: vi.fn(),
    });
  });

  it('renders progress details from app context while generating', () => {
    useAppMock.mockReturnValue({
      shell: connectedShell,
      membershipMatrixGeneration: {
        requestedKind: 'distributionList',
        phase: 'generating',
        progressMessage: 'Reading members.',
        progressPercent: 42,
        result: null,
        error: null,
      },
      generateMembershipMatrix: vi.fn(async () => undefined),
      clearMembershipMatrixGeneration: vi.fn(),
    });

    const html = renderToStaticMarkup(React.createElement(ReportsScreen));

    expect(html).toContain('Generating…');
    expect(html).toContain('Reading members.');
    expect(html).toContain('42%');
  });

  it('renders saved report details from app context after success', () => {
    useAppMock.mockReturnValue({
      shell: connectedShell,
      membershipMatrixGeneration: {
        requestedKind: 'all',
        phase: 'success',
        progressMessage: '',
        progressPercent: 100,
        result: {
          appliedKind: 'all',
          outputPath: 'C:/Reports/membership-matrix.xlsx',
          generatedAt: '2026-04-20T02:00:00.000Z',
          summary: {
            groupCount: 3,
            recipientCount: 25,
            membershipCount: 40,
          },
        },
        error: null,
      },
      generateMembershipMatrix: vi.fn(async () => undefined),
      clearMembershipMatrixGeneration: vi.fn(),
    });

    const html = renderToStaticMarkup(React.createElement(ReportsScreen));

    expect(html).toContain('Report saved');
    expect(html).toContain('C:/Reports/membership-matrix.xlsx');
    expect(html).toContain('3 groups · 25 recipients · 40 memberships');
  });

  it('renders the persisted error from app context', () => {
    useAppMock.mockReturnValue({
      shell: connectedShell,
      membershipMatrixGeneration: {
        requestedKind: 'mailEnabledSecurityGroup',
        phase: 'error',
        progressMessage: '',
        progressPercent: 0,
        result: null,
        error: 'Report generation failed.',
      },
      generateMembershipMatrix: vi.fn(async () => undefined),
      clearMembershipMatrixGeneration: vi.fn(),
    });

    const html = renderToStaticMarkup(React.createElement(ReportsScreen));

    expect(html).toContain('Generation failed');
    expect(html).toContain('Report generation failed.');
  });

  it('retries with the persisted requested kind after remount', async () => {
    const generateMembershipMatrixMock = vi.fn(async () => undefined);

    useAppMock.mockReturnValue({
      shell: connectedShell,
      membershipMatrixGeneration: {
        requestedKind: 'mailEnabledSecurityGroup',
        phase: 'error',
        progressMessage: '',
        progressPercent: 0,
        result: null,
        error: 'Report generation failed.',
      },
      generateMembershipMatrix: generateMembershipMatrixMock,
      clearMembershipMatrixGeneration: vi.fn(),
    });

    renderToStaticMarkup(React.createElement(ReportsScreen));

    const retryButton = buttonProps.find((props) => getTextContent(props.children as React.ReactNode).includes('Retry'));
    expect(retryButton).toBeDefined();

    const onClick = retryButton?.onClick;
    expect(typeof onClick).toBe('function');

    await (onClick as () => Promise<void>)();

    expect(generateMembershipMatrixMock).toHaveBeenCalledWith('mailEnabledSecurityGroup');
  });
});
