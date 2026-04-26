import { z } from 'zod';

import { executePowerShellWorkerCommand } from '@/main/powershell/execute-powershell-worker-command';
import {
  exchangeCapabilitiesSchema,
  type ExchangeCapabilities,
} from '@/shared/contracts/exchange';

const exchangeWorkerModuleSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  moduleBase: z.string().min(1),
  commandChecks: z.object({
    connectExchangeOnline: z.boolean(),
    disconnectExchangeOnline: z.boolean(),
    getConnectionInformation: z.boolean(),
  }),
  import: z
    .object({
      importable: z.boolean(),
      name: z.string().min(1).optional(),
      version: z.string().min(1).optional(),
      moduleBase: z.string().min(1).optional(),
      error: z.string().min(1).optional(),
    })
    .optional(),
});

const exchangeInstallResultSchema = z.object({
  status: z.enum(['ready', 'warning', 'missing']),
  detail: z.string().min(1),
  psVersion: z.string().min(1),
  psEdition: z.string().min(1),
  executionPolicy: z.string().min(1),
  exchangeOnlineManagement: exchangeWorkerModuleSchema,
});

export async function installExchangeModule(): Promise<ExchangeCapabilities> {
  const execution = await executePowerShellWorkerCommand('exchange.installModule', {
    timeoutMs: 180_000,
  });

  if (execution.kind === 'unsupported-host' || execution.kind === 'worker-error') {
    return exchangeCapabilitiesSchema.parse({
      status: 'warning',
      detail: execution.detail,
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
  }

  if (execution.kind === 'missing-runtime') {
    return exchangeCapabilitiesSchema.parse({
      status: 'missing',
      detail: execution.detail,
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
  }

  const parsed = exchangeInstallResultSchema.parse(JSON.parse(execution.stdout));
  const normalizedStatus =
    parsed.status === 'ready' && execution.runtime.command !== 'powershell.exe'
      ? 'warning'
      : parsed.status;
  const normalizedDetail =
    parsed.status === 'ready' && execution.runtime.command !== 'powershell.exe'
      ? `${parsed.detail} PowerShell 7 is usable, but Groups Console currently treats Windows PowerShell 5.1 as the preferred Exchange runtime.`
      : parsed.detail;

  return exchangeCapabilitiesSchema.parse({
    status: normalizedStatus,
    detail: normalizedDetail,
    runtime: {
      command: execution.runtime.command,
      label: execution.runtime.label,
      version: parsed.psVersion,
      edition: parsed.psEdition,
    },
    exchangeModule: {
      installed: true,
      importable: parsed.exchangeOnlineManagement.import?.importable ?? false,
      version: parsed.exchangeOnlineManagement.version,
      moduleBase: parsed.exchangeOnlineManagement.moduleBase,
      importError: parsed.exchangeOnlineManagement.import?.error ?? null,
      commandChecks: parsed.exchangeOnlineManagement.commandChecks,
    },
  });
}
