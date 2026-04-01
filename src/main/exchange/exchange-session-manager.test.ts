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

  it('returns an error state when the host cannot be started', async () => {
    const manager = new ExchangeSessionManager();

    vi.mocked(startExchangeSessionHost).mockRejectedValue(new Error('Host startup failed.'));

    const result = await manager.connect({ userPrincipalName: 'admin@example.com' });

    expect(result.state).toBe('error');
    expect(result.detail).toContain('Host startup failed.');
  });
});
