import { describe, expect, it, vi } from 'vitest';

vi.mock('@/main/powershell/execute-radapp-worker-command', () => ({
  executeRadAppWorkerCommand: vi.fn(),
}));

import { executeRadAppWorkerCommand } from '@/main/powershell/execute-radapp-worker-command';

import { installExchangeModule } from './install-exchange-module';

function makeInstallStdout(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    status: 'ready',
    detail: 'ExchangeOnlineManagement 3.9.0 is installed and importable.',
    psVersion: '5.1.22621.4391',
    psEdition: 'Desktop',
    executionPolicy: 'RemoteSigned',
    exchangeOnlineManagement: {
      name: 'ExchangeOnlineManagement',
      version: '3.9.0',
      moduleBase: 'C:/Users/Admin/Documents/WindowsPowerShell/Modules/ExchangeOnlineManagement/3.9.0',
      commandChecks: {
        connectExchangeOnline: true,
        disconnectExchangeOnline: true,
        getConnectionInformation: true,
      },
      import: {
        importable: true,
        name: 'ExchangeOnlineManagement',
        version: '3.9.0',
        moduleBase: 'C:/Users/Admin/Documents/WindowsPowerShell/Modules/ExchangeOnlineManagement/3.9.0',
      },
    },
    ...overrides,
  });
}

describe('installExchangeModule', () => {
  it('normalizes ready PowerShell 7 install results to a warning', async () => {
    vi.mocked(executeRadAppWorkerCommand).mockResolvedValue({
      kind: 'executed',
      runtime: {
        command: 'pwsh.exe',
        label: 'PowerShell',
      },
      stdout: makeInstallStdout({
        psVersion: '7.4.0',
        psEdition: 'Core',
      }),
      stderr: '',
    });

    const result = await installExchangeModule();

    expect(result.status).toBe('warning');
    expect(result.detail).toContain('Windows PowerShell 5.1');
    expect(result.runtime).toMatchObject({
      command: 'pwsh.exe',
      label: 'PowerShell',
      version: '7.4.0',
      edition: 'Core',
    });
  });

  it('preserves installed module details when install completes but import is not ready', async () => {
    vi.mocked(executeRadAppWorkerCommand).mockResolvedValue({
      kind: 'executed',
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
      },
      stdout: makeInstallStdout({
        status: 'warning',
        detail: 'ExchangeOnlineManagement 3.9.0 is installed but not importable: import blocked.',
        exchangeOnlineManagement: {
          name: 'ExchangeOnlineManagement',
          version: '3.9.0',
          moduleBase: 'C:/Users/Admin/Documents/WindowsPowerShell/Modules/ExchangeOnlineManagement/3.9.0',
          commandChecks: {
            connectExchangeOnline: false,
            disconnectExchangeOnline: false,
            getConnectionInformation: false,
          },
          import: {
            importable: false,
            error: 'import blocked.',
          },
        },
      }),
      stderr: '',
    });

    const result = await installExchangeModule();

    expect(result.status).toBe('warning');
    expect(result.exchangeModule.installed).toBe(true);
    expect(result.exchangeModule.importable).toBe(false);
    expect(result.exchangeModule.importError).toBe('import blocked.');
  });
});
