import { execFile } from 'node:child_process';

import { getGroupsConsoleWorkerScriptPath } from '@/main/app/paths';

export type PowerShellWorkerCommand =
  | 'bootstrap.inspectEnvironment'
  | 'exchange.getCapabilities'
  | 'exchange.installModule';

export type WorkerExecutionResult =
  | {
      kind: 'unsupported-host';
      detail: string;
    }
  | {
      kind: 'missing-runtime';
      detail: string;
    }
  | {
      kind: 'worker-error';
      detail: string;
    }
  | {
      kind: 'executed';
      runtime: {
        command: 'powershell.exe' | 'pwsh.exe';
        label: 'Windows PowerShell' | 'PowerShell';
      };
      stdout: string;
      stderr: string;
    };

const WINDOWS_CANDIDATES: Array<{
  command: 'powershell.exe' | 'pwsh.exe';
  label: 'Windows PowerShell' | 'PowerShell';
}> = [
  { command: 'powershell.exe', label: 'Windows PowerShell' },
  { command: 'pwsh.exe', label: 'PowerShell' },
];

export async function executePowerShellWorkerCommand(
  workerCommand: PowerShellWorkerCommand,
  options: { timeoutMs?: number } = {},
): Promise<WorkerExecutionResult> {
  if (process.platform !== 'win32') {
    return {
      kind: 'unsupported-host',
      detail: `Current host platform is ${process.platform}. Groups Console worker commands target Windows admin workstations.`,
    };
  }

  const workerScriptPath = getGroupsConsoleWorkerScriptPath();

  for (const candidate of WINDOWS_CANDIDATES) {
    try {
      const { stdout, stderr } = await execPowerShellWorker(
        candidate.command,
        workerScriptPath,
        workerCommand,
        options,
      );

      return {
        kind: 'executed',
        runtime: {
          command: candidate.command,
          label: candidate.label,
        },
        stdout,
        stderr,
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        continue;
      }

      return {
        kind: 'worker-error',
        detail:
          error instanceof Error
            ? error.message
            : 'Unknown PowerShell worker execution failure.',
      };
    }
  }

  return {
    kind: 'missing-runtime',
    detail: 'No supported PowerShell runtime executable was found on this Windows host.',
  };
}

function execPowerShellWorker(
  command: 'powershell.exe' | 'pwsh.exe',
  workerScriptPath: string,
  workerCommand: PowerShellWorkerCommand,
  options: { timeoutMs?: number },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        workerScriptPath,
        '-CommandName',
        workerCommand,
      ],
      {
        windowsHide: true,
        timeout: options.timeoutMs ?? 10_000,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(error instanceof Error ? error : new Error('Unknown PowerShell worker execution failure.'));
          return;
        }

        resolve({ stdout, stderr });
      },
    );
  });
}
