import { z } from 'zod';

import { executePowerShellWorkerCommand } from '@/main/powershell/execute-powershell-worker-command';
import {
  exchangeCapabilitiesSchema,
  type ExchangeCapabilities,
} from '@/shared/contracts/exchange';

const exchangeWorkerModuleSchema = z
  .object({
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
  })
  .nullable();

const exchangeWorkerCapabilitiesSchema = z.object({
  status: z.enum(['ready', 'warning', 'missing']),
  detail: z.string().min(1),
  psVersion: z.string().min(1),
  psEdition: z.string().min(1),
  executionPolicy: z.string().min(1),
  exchangeOnlineManagement: exchangeWorkerModuleSchema,
});

function createUnavailableCapabilities(status: 'warning' | 'missing', detail: string): ExchangeCapabilities {
  return exchangeCapabilitiesSchema.parse({
    status,
      detail,
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

export async function getExchangeCapabilities(): Promise<ExchangeCapabilities> {
  const execution = await executePowerShellWorkerCommand('exchange.getCapabilities');

  if (execution.kind === 'unsupported-host' || execution.kind === 'worker-error') {
    return createUnavailableCapabilities('warning', execution.detail);
  }

  if (execution.kind === 'missing-runtime') {
    return createUnavailableCapabilities('missing', execution.detail);
  }

  const rawCapabilities: unknown = JSON.parse(execution.stdout);
  const parsed = exchangeWorkerCapabilitiesSchema.parse(rawCapabilities);

  const runtime = {
    command: execution.runtime.command,
    label: execution.runtime.label,
    version: parsed.psVersion,
    edition: parsed.psEdition,
  };

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
    runtime,
    exchangeModule: {
      installed: parsed.exchangeOnlineManagement !== null,
      importable: parsed.exchangeOnlineManagement?.import?.importable ?? false,
      version: parsed.exchangeOnlineManagement?.version ?? null,
      moduleBase: parsed.exchangeOnlineManagement?.moduleBase ?? null,
      importError: parsed.exchangeOnlineManagement?.import?.error ?? null,
      commandChecks: parsed.exchangeOnlineManagement?.commandChecks ?? {
        connectExchangeOnline: false,
        disconnectExchangeOnline: false,
        getConnectionInformation: false,
      },
    },
  });
}
