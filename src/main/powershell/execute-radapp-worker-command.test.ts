import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

vi.mock('@/main/app/paths', () => ({
  getRadAppWorkerScriptPath: () => 'C:/GroupsConsole/powershell/bootstrap/worker.ps1',
}));

import { executeRadAppWorkerCommand } from './execute-radapp-worker-command';

describe('executeRadAppWorkerCommand', () => {
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

    const result = await executeRadAppWorkerCommand('exchange.getCapabilities');

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
          callback(null, '{"ok":true}', '');
        },
      );

    const result = await executeRadAppWorkerCommand('exchange.getCapabilities');

    expect(execFileMock).toHaveBeenNthCalledWith(
      1,
      'powershell.exe',
      expect.arrayContaining(['-CommandName', 'exchange.getCapabilities']),
      expect.any(Object),
      expect.any(Function),
    );
    expect(execFileMock).toHaveBeenNthCalledWith(
      2,
      'pwsh.exe',
      expect.arrayContaining(['-CommandName', 'exchange.getCapabilities']),
      expect.any(Object),
      expect.any(Function),
    );
    expect(result.kind).toBe('executed');
  });
});
