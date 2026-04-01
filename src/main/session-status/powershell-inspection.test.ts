import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

vi.mock('@/main/app/paths', () => ({
  getRadAppWorkerScriptPath: () => 'C:/RADApp/powershell/bootstrap/worker.ps1',
}));

import { inspectLocalPowerShellEnvironment } from './powershell-inspection';

describe('inspectLocalPowerShellEnvironment', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    execFileMock.mockReset();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
    });
  });

  it('returns unsupported-host outside Windows', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'linux',
    });

    const result = await inspectLocalPowerShellEnvironment();

    expect(result.kind).toBe('unsupported-host');
  });

  it('tries powershell.exe first and falls back to pwsh.exe on ENOENT', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });

    execFileMock
      .mockImplementationOnce(
        (
          _command: string,
          _args: string[],
          _options: unknown,
          callback: (error: NodeJS.ErrnoException | null, stdout?: string, stderr?: string) => void,
        ) => {
          callback(Object.assign(new Error('missing'), { code: 'ENOENT' }), '', '');
        },
      )
      .mockImplementationOnce(
        (
          _command: string,
          _args: string[],
          _options: unknown,
          callback: (error: NodeJS.ErrnoException | null, stdout?: string, stderr?: string) => void,
        ) => {
          callback(
            null,
            JSON.stringify({
              psVersion: '7.4.6',
              psEdition: 'Core',
              executionPolicy: 'Bypass',
              executionPolicies: [{ scope: 'Process', executionPolicy: 'Bypass' }],
              exchangeOnlineManagement: {
                name: 'ExchangeOnlineManagement',
                version: '3.9.0',
                moduleBase: 'C:/Program Files/PowerShell/Modules/ExchangeOnlineManagement',
                import: {
                  importable: true,
                  name: 'ExchangeOnlineManagement',
                  version: '3.9.0',
                  moduleBase: 'C:/Program Files/PowerShell/Modules/ExchangeOnlineManagement',
                },
              },
            }),
            '',
          );
        },
      );

    const result = await inspectLocalPowerShellEnvironment();

    expect(execFileMock).toHaveBeenNthCalledWith(
      1,
      'powershell.exe',
      expect.arrayContaining(['-ExecutionPolicy', 'Bypass', '-File', 'C:/RADApp/powershell/bootstrap/worker.ps1']),
      expect.any(Object),
      expect.any(Function),
    );
    expect(execFileMock).toHaveBeenNthCalledWith(
      2,
      'pwsh.exe',
      expect.arrayContaining(['-ExecutionPolicy', 'Bypass', '-File', 'C:/RADApp/powershell/bootstrap/worker.ps1']),
      expect.any(Object),
      expect.any(Function),
    );
    expect(result.kind).toBe('detected');
    if (result.kind === 'detected') {
      expect(result.runtime.command).toBe('pwsh.exe');
      expect(result.runtime.exchangeModule?.import?.importable).toBe(true);
    }
  });

  it('returns probe-error when worker output is not valid JSON', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });

    execFileMock.mockImplementation(
      (
        _command: string,
        _args: string[],
        _options: unknown,
        callback: (error: NodeJS.ErrnoException | null, stdout?: string, stderr?: string) => void,
      ) => {
        callback(null, 'not-json', '');
      },
    );

    const result = await inspectLocalPowerShellEnvironment();

    expect(result.kind).toBe('probe-error');
  });
});
