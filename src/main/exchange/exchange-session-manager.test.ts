import { describe, expect, it, vi } from 'vitest';

vi.mock('@/main/powershell/start-exchange-session-host', () => ({
  startExchangeSessionHost: vi.fn(),
}));

import { startExchangeSessionHost } from '@/main/powershell/start-exchange-session-host';

import { ExchangeSessionManager } from './exchange-session-manager';

describe('ExchangeSessionManager', () => {
  it('returns disconnected status when the host is not running', async () => {
    const manager = new ExchangeSessionManager();

    const result = await manager.getConnectionStatus();

    expect(result.state).toBe('disconnected');
  });

  it('starts a host and returns parsed connection state on connect', async () => {
    const manager = new ExchangeSessionManager();

    vi.mocked(startExchangeSessionHost).mockResolvedValue({
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
      },
      request: vi.fn().mockResolvedValue({
        state: 'connected',
        detail: 'Connected to Exchange Online.',
        psVersion: '5.1.19041.1',
        psEdition: 'Desktop',
        userPrincipalName: 'admin@example.com',
        connectionId: 'connection-1',
        tenantId: 'tenant-1',
        tokenStatus: 'Active',
        tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
        connectedAtUtc: '2026-04-01T10:00:00.000Z',
      }),
      dispose: vi.fn().mockResolvedValue(undefined),
    });

    const result = await manager.connect({ userPrincipalName: 'admin@example.com' });

    expect(result.state).toBe('connected');
    expect(result.runtime?.command).toBe('powershell.exe');
  });

  it('disconnects idempotently when no host exists', async () => {
    const manager = new ExchangeSessionManager();

    const result = await manager.disconnect();

    expect(result.state).toBe('disconnected');
  });

  it('lists groups through the live host', async () => {
    const manager = new ExchangeSessionManager();

    vi.mocked(startExchangeSessionHost).mockResolvedValue({
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
      },
      request: vi
        .fn()
        .mockResolvedValueOnce({
          state: 'connected',
          detail: 'Connected to Exchange Online.',
          psVersion: '5.1.19041.1',
          psEdition: 'Desktop',
          userPrincipalName: 'admin@example.com',
          connectionId: 'connection-1',
          tenantId: 'tenant-1',
          tokenStatus: 'Active',
          tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
          connectedAtUtc: '2026-04-01T10:00:00.000Z',
        })
        .mockResolvedValueOnce({
          appliedKind: 'mailEnabledSecurityGroup',
          items: [
            {
              objectId: null,
              exchangeIdentity: 'group-identity-2',
              displayName: 'IT Security',
              alias: 'itsecurity',
              primaryEmail: 'itsecurity@example.com',
              groupKind: 'mailEnabledSecurityGroup',
              managedByDisplayNames: ['Owner One'],
              whenChangedUtc: '2026-04-01T12:00:00.000Z',
            },
          ],
        }),
      dispose: vi.fn().mockResolvedValue(undefined),
    });

    await manager.connect({ userPrincipalName: 'admin@example.com' });
    const result = await manager.listGroups({ kind: 'mailEnabledSecurityGroup' });

    expect(result.appliedKind).toBe('mailEnabledSecurityGroup');
    expect(result.items[0]?.groupKind).toBe('mailEnabledSecurityGroup');
  });

  it('reads group members through the live host', async () => {
    const manager = new ExchangeSessionManager();

    vi.mocked(startExchangeSessionHost).mockResolvedValue({
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
      },
      request: vi
        .fn()
        .mockResolvedValueOnce({
          state: 'connected',
          detail: 'Connected to Exchange Online.',
          psVersion: '5.1.19041.1',
          psEdition: 'Desktop',
          userPrincipalName: 'admin@example.com',
          connectionId: 'connection-1',
          tenantId: 'tenant-1',
          tokenStatus: 'Active',
          tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
          connectedAtUtc: '2026-04-01T10:00:00.000Z',
        })
        .mockResolvedValueOnce({
          group: {
            exchangeIdentity: 'finance-group',
            objectId: null,
            groupKind: 'distributionList',
          },
          items: [
            {
              objectId: 'recipient-1',
              exchangeIdentity: 'recipient-identity-1',
              displayName: 'Jane Example',
              primaryEmail: 'jane@example.com',
              alias: 'jexample',
              recipientType: 'mailbox',
              recipientTypeDetails: 'UserMailbox',
            },
          ],
        }),
      dispose: vi.fn().mockResolvedValue(undefined),
    });

    await manager.connect({ userPrincipalName: 'admin@example.com' });
    const result = await manager.getGroupMembers({
      group: {
        exchangeIdentity: 'finance-group',
        objectId: null,
        groupKind: 'distributionList',
      },
    });

    expect(result.items[0]?.primaryEmail).toBe('jane@example.com');
  });

  it('does not clear the host on ordinary member-read failures', async () => {
    const manager = new ExchangeSessionManager();
    const requestMock = vi
      .fn()
      .mockResolvedValueOnce({
        state: 'connected',
        detail: 'Connected to Exchange Online.',
        psVersion: '5.1.19041.1',
        psEdition: 'Desktop',
        userPrincipalName: 'admin@example.com',
        connectionId: 'connection-1',
        tenantId: 'tenant-1',
        tokenStatus: 'Active',
        tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
        connectedAtUtc: '2026-04-01T10:00:00.000Z',
      })
      .mockRejectedValueOnce(new Error('Member read failed.'))
      .mockResolvedValueOnce({
        state: 'connected',
        detail: 'Connected to Exchange Online.',
        psVersion: '5.1.19041.1',
        psEdition: 'Desktop',
        userPrincipalName: 'admin@example.com',
        connectionId: 'connection-1',
        tenantId: 'tenant-1',
        tokenStatus: 'Active',
        tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
        connectedAtUtc: '2026-04-01T10:00:00.000Z',
      });

    vi.mocked(startExchangeSessionHost).mockResolvedValue({
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
      },
      request: requestMock,
      dispose: vi.fn().mockResolvedValue(undefined),
    });

    await manager.connect({ userPrincipalName: 'admin@example.com' });
    await expect(
      manager.getGroupMembers({
        group: {
          exchangeIdentity: 'finance-group',
          objectId: null,
          groupKind: 'distributionList',
        },
      }),
    ).rejects.toThrow('Member read failed.');

    const status = await manager.getConnectionStatus();
    expect(status.state).toBe('connected');
  });

  it('does not clear the host on ordinary list command failures', async () => {
    const manager = new ExchangeSessionManager();
    const requestMock = vi
      .fn()
      .mockResolvedValueOnce({
        state: 'connected',
        detail: 'Connected to Exchange Online.',
        psVersion: '5.1.19041.1',
        psEdition: 'Desktop',
        userPrincipalName: 'admin@example.com',
        connectionId: 'connection-1',
        tenantId: 'tenant-1',
        tokenStatus: 'Active',
        tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
        connectedAtUtc: '2026-04-01T10:00:00.000Z',
      })
      .mockRejectedValueOnce(new Error('List failed.'))
      .mockResolvedValueOnce({
        state: 'connected',
        detail: 'Connected to Exchange Online.',
        psVersion: '5.1.19041.1',
        psEdition: 'Desktop',
        userPrincipalName: 'admin@example.com',
        connectionId: 'connection-1',
        tenantId: 'tenant-1',
        tokenStatus: 'Active',
        tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
        connectedAtUtc: '2026-04-01T10:00:00.000Z',
      });

    vi.mocked(startExchangeSessionHost).mockResolvedValue({
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
      },
      request: requestMock,
      dispose: vi.fn().mockResolvedValue(undefined),
    });

    await manager.connect({ userPrincipalName: 'admin@example.com' });
    await expect(manager.listGroups({ kind: 'all' })).rejects.toThrow('List failed.');

    const status = await manager.getConnectionStatus();
    expect(status.state).toBe('connected');
  });

  it('returns an error state when the host cannot be started', async () => {
    const manager = new ExchangeSessionManager();

    vi.mocked(startExchangeSessionHost).mockRejectedValue(new Error('Host startup failed.'));

    const result = await manager.connect({ userPrincipalName: 'admin@example.com' });

    expect(result.state).toBe('error');
    expect(result.detail).toContain('Host startup failed.');
  });
});
