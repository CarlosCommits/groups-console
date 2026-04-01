import { execFile } from 'node:child_process';

import { z } from 'zod';

import { getRadAppWorkerScriptPath } from '@/main/app/paths';

const executionPolicyEntrySchema = z.object({
  scope: z.string().min(1),
  executionPolicy: z.string().min(1),
});

const exchangeModuleSchema = z
  .object({
    name: z.string().min(1),
    version: z.string().min(1),
    moduleBase: z.string().min(1),
    import: z
      .object({
        importable: z.boolean(),
        name: z.string().min(1).optional(),
        version: z.string().min(1).optional(),
        moduleBase: z.string().min(1).optional(),
        error: z.string().min(1).optional(),
      })
      .optional(),
  })
  .nullable();

const powershellProbeSchema = z.object({
  psVersion: z.string().min(1),
  psEdition: z.string().min(1),
  executionPolicy: z.string().min(1),
  executionPolicies: z.array(executionPolicyEntrySchema),
  exchangeOnlineManagement: exchangeModuleSchema,
});

export type PowerShellInspection =
  | {
      kind: 'unsupported-host';
      detail: string;
    }
  | {
      kind: 'missing-runtime';
      detail: string;
    }
  | {
      kind: 'probe-error';
      detail: string;
    }
  | {
      kind: 'detected';
      runtime: {
        command: 'powershell.exe' | 'pwsh.exe';
        label: 'Windows PowerShell' | 'PowerShell';
        version: string;
        edition: string;
        executionPolicy: string;
        executionPolicies: Array<{
          scope: string;
          executionPolicy: string;
        }>;
        exchangeModule: {
          name: string;
          version: string;
          moduleBase: string;
          import?: {
            importable: boolean;
            name?: string;
            version?: string;
            moduleBase?: string;
            error?: string;
          } | undefined;
        } | null;
      };
    };

const WINDOWS_CANDIDATES: Array<{
  command: 'powershell.exe' | 'pwsh.exe';
  label: 'Windows PowerShell' | 'PowerShell';
}> = [
  { command: 'powershell.exe', label: 'Windows PowerShell' },
  { command: 'pwsh.exe', label: 'PowerShell' },
];

export async function inspectLocalPowerShellEnvironment(): Promise<PowerShellInspection> {
  if (process.platform !== 'win32') {
    return {
      kind: 'unsupported-host',
      detail: `Current host platform is ${process.platform}. RAD App bootstrap checks target Windows admin workstations.`,
    };
  }

  const workerScriptPath = getRadAppWorkerScriptPath();

  for (const candidate of WINDOWS_CANDIDATES) {
    try {
      const { stdout } = await execPowerShellWorker(candidate.command, workerScriptPath);

      const rawProbeResult: unknown = JSON.parse(stdout);
      const parsed = powershellProbeSchema.parse(rawProbeResult);

      return {
        kind: 'detected',
        runtime: {
          command: candidate.command,
          label: candidate.label,
          version: parsed.psVersion,
          edition: parsed.psEdition,
          executionPolicy: parsed.executionPolicy,
          executionPolicies: parsed.executionPolicies,
          exchangeModule: parsed.exchangeOnlineManagement,
        },
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

      const message = error instanceof Error ? error.message : 'Unknown PowerShell probe failure.';

      return {
        kind: 'probe-error',
        detail: `${candidate.label} readiness probe failed: ${message}`,
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
        'bootstrap.inspectEnvironment',
      ],
      {
        windowsHide: true,
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            error instanceof Error
              ? error
              : new Error('Unknown PowerShell worker execution failure.'),
          );
          return;
        }

        resolve({ stdout, stderr });
      },
    );
  });
}
