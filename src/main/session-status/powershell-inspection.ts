import { z } from 'zod';

import { executePowerShellWorkerCommand } from '@/main/powershell/execute-powershell-worker-command';

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

export async function inspectLocalPowerShellEnvironment(): Promise<PowerShellInspection> {
  const execution = await executePowerShellWorkerCommand('bootstrap.inspectEnvironment');

  if (execution.kind === 'unsupported-host') {
    return {
      kind: 'unsupported-host',
      detail: execution.detail,
    };
  }

  if (execution.kind === 'missing-runtime') {
    return {
      kind: 'missing-runtime',
      detail: execution.detail,
    };
  }

  if (execution.kind === 'worker-error') {
    return {
      kind: 'probe-error',
      detail: execution.detail,
    };
  }

  const rawProbeResult: unknown = JSON.parse(execution.stdout);
  const parsed = powershellProbeSchema.parse(rawProbeResult);

  return {
    kind: 'detected',
    runtime: {
      command: execution.runtime.command,
      label: execution.runtime.label,
      version: parsed.psVersion,
      edition: parsed.psEdition,
      executionPolicy: parsed.executionPolicy,
      executionPolicies: parsed.executionPolicies,
      exchangeModule: parsed.exchangeOnlineManagement,
    },
  };
}
