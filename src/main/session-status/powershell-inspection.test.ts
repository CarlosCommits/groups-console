import { describe, expect, it, vi } from 'vitest';

vi.mock('@/main/powershell/execute-radapp-worker-command', () => ({
  executeRadAppWorkerCommand: vi.fn(),
}));

import { executeRadAppWorkerCommand } from '@/main/powershell/execute-radapp-worker-command';

import { inspectLocalPowerShellEnvironment } from './powershell-inspection';

describe('inspectLocalPowerShellEnvironment', () => {
  it('parses executed worker output into a detected runtime result', async () => {
    vi.mocked(executeRadAppWorkerCommand).mockResolvedValue({
      kind: 'executed',
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
      },
      stdout: JSON.stringify({
        psVersion: '5.1.19041.1',
        psEdition: 'Desktop',
        executionPolicy: 'RemoteSigned',
        executionPolicies: [{ scope: 'CurrentUser', executionPolicy: 'RemoteSigned' }],
        exchangeOnlineManagement: {
          name: 'ExchangeOnlineManagement',
          version: '3.9.0',
          moduleBase: 'C:/Users/test/Documents/WindowsPowerShell/Modules/ExchangeOnlineManagement',
          import: {
            importable: true,
          },
        },
      }),
      stderr: '',
    });

    const result = await inspectLocalPowerShellEnvironment();

    expect(result.kind).toBe('detected');
    if (result.kind === 'detected') {
      expect(result.runtime.command).toBe('powershell.exe');
      expect(result.runtime.version).toBe('5.1.19041.1');
    }
  });

  it('maps worker errors into probe-error results', async () => {
    vi.mocked(executeRadAppWorkerCommand).mockResolvedValue({
      kind: 'worker-error',
      detail: 'Worker failed to start.',
    });

    const result = await inspectLocalPowerShellEnvironment();

    expect(result.kind).toBe('probe-error');
  });
});
