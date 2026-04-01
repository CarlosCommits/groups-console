import { describe, expect, it, vi } from 'vitest';

vi.mock('./get-exchange-capabilities', () => ({
  getExchangeCapabilities: vi.fn(),
}));

vi.mock('./exchange-session-manager', () => ({
  exchangeSessionManager: {
    connect: vi.fn(),
  },
}));

import { getExchangeCapabilities } from './get-exchange-capabilities';
import { exchangeSessionManager } from './exchange-session-manager';

import { connectExchange } from './connect-exchange';

describe('connectExchange', () => {
  it('blocks connection when the Exchange module is not installed', async () => {
    vi.mocked(getExchangeCapabilities).mockResolvedValue({
      status: 'missing',
      detail: 'missing',
      runtime: null,
      exchangeModule: {
        installed: false,
        importable: false,
        version: null,
        moduleBase: null,
        importError: null,
        commandChecks: {
          connectExchangeOnline: false,
          disconnectExchangeOnline: false,
          getConnectionInformation: false,
        },
      },
    });

    const result = await connectExchange({ userPrincipalName: 'admin@example.com' });

    expect(result.state).toBe('error');
  });

  it('delegates to the session manager when capabilities are ready enough', async () => {
    vi.mocked(getExchangeCapabilities).mockResolvedValue({
      status: 'ready',
      detail: 'ready',
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
        version: '5.1',
        edition: 'Desktop',
      },
      exchangeModule: {
        installed: true,
        importable: true,
        version: '3.9.0',
        moduleBase: 'C:/module',
        importError: null,
        commandChecks: {
          connectExchangeOnline: true,
          disconnectExchangeOnline: true,
          getConnectionInformation: true,
        },
      },
    });
    vi.mocked(exchangeSessionManager.connect).mockResolvedValue({
      state: 'connected',
      detail: 'Connected.',
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
        version: '5.1',
        edition: 'Desktop',
      },
      userPrincipalName: 'admin@example.com',
      connectionId: 'conn-1',
      tenantId: 'tenant-1',
      tokenStatus: 'Active',
      tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
      connectedAtUtc: '2026-04-01T10:00:00.000Z',
    });

    const result = await connectExchange({ userPrincipalName: 'admin@example.com' });

    expect(result.state).toBe('connected');
    expect(exchangeSessionManager.connect).toHaveBeenCalledWith({
      userPrincipalName: 'admin@example.com',
    });
  });
});
