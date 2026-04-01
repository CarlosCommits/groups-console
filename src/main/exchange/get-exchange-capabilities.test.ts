import { describe, expect, it, vi } from 'vitest';

vi.mock('@/main/powershell/execute-radapp-worker-command', () => ({
  executeRadAppWorkerCommand: vi.fn(),
}));

import { executeRadAppWorkerCommand } from '@/main/powershell/execute-radapp-worker-command';

import { getExchangeCapabilities } from './get-exchange-capabilities';

describe('getExchangeCapabilities', () => {
  it('maps executed worker output into exchange capabilities', async () => {
    vi.mocked(executeRadAppWorkerCommand).mockResolvedValue({
      kind: 'executed',
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
      },
      stdout: JSON.stringify({
        status: 'ready',
        detail: 'ExchangeOnlineManagement is importable and ready for a future connection flow.',
        psVersion: '5.1.19041.1',
        psEdition: 'Desktop',
        executionPolicy: 'RemoteSigned',
        exchangeOnlineManagement: {
          name: 'ExchangeOnlineManagement',
          version: '3.9.0',
          moduleBase: 'C:/Users/test/Documents/WindowsPowerShell/Modules/ExchangeOnlineManagement',
          commandChecks: {
            connectExchangeOnline: true,
            disconnectExchangeOnline: true,
            getConnectionInformation: true,
          },
          import: {
            importable: true,
            name: 'ExchangeOnlineManagement',
            version: '3.9.0',
            moduleBase: 'C:/Users/test/Documents/WindowsPowerShell/Modules/ExchangeOnlineManagement',
          },
        },
      }),
      stderr: '',
    });

    const result = await getExchangeCapabilities();

    expect(result.status).toBe('ready');
    expect(result.runtime?.command).toBe('powershell.exe');
    expect(result.exchangeModule.importable).toBe(true);
    expect(result.exchangeModule.commandChecks.connectExchangeOnline).toBe(true);
  });

  it('degrades worker errors into a warning response', async () => {
    vi.mocked(executeRadAppWorkerCommand).mockResolvedValue({
      kind: 'worker-error',
      detail: 'Worker failed to start.',
    });

    const result = await getExchangeCapabilities();

    expect(result.status).toBe('warning');
    expect(result.runtime).toBeNull();
    expect(result.exchangeModule.importable).toBe(false);
  });

  it('downgrades pwsh-only readiness to warning for consistency with bootstrap policy', async () => {
    vi.mocked(executeRadAppWorkerCommand).mockResolvedValue({
      kind: 'executed',
      runtime: {
        command: 'pwsh.exe',
        label: 'PowerShell',
      },
      stdout: JSON.stringify({
        status: 'ready',
        detail: 'ExchangeOnlineManagement is importable and ready for a future connection flow.',
        psVersion: '7.4.6',
        psEdition: 'Core',
        executionPolicy: 'Bypass',
        exchangeOnlineManagement: {
          name: 'ExchangeOnlineManagement',
          version: '3.9.0',
          moduleBase: 'C:/Program Files/PowerShell/Modules/ExchangeOnlineManagement',
          commandChecks: {
            connectExchangeOnline: true,
            disconnectExchangeOnline: true,
            getConnectionInformation: true,
          },
          import: {
            importable: true,
          },
        },
      }),
      stderr: '',
    });

    const result = await getExchangeCapabilities();

    expect(result.status).toBe('warning');
    expect(result.detail).toContain('preferred Exchange runtime');
  });
});
