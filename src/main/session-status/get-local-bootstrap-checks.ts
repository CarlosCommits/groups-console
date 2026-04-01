import type { BootstrapCheck } from '@/shared/dto/session-status';

import {
  checkLogDirectoryReadiness,
  checkTenantConfigPresence,
} from './local-filesystem-checks';
import { inspectLocalPowerShellEnvironment } from './powershell-inspection';

function mapPowerShellCheck(result: Awaited<ReturnType<typeof inspectLocalPowerShellEnvironment>>): BootstrapCheck {
  if (result.kind === 'detected') {
    if (result.runtime.command === 'powershell.exe') {
      return {
        id: 'powershell',
        label: 'PowerShell runtime',
        status: 'ready',
        detail: `Detected ${result.runtime.label} ${result.runtime.version} (${result.runtime.edition}) with effective execution policy ${result.runtime.executionPolicy}.`,
      };
    }

    return {
      id: 'powershell',
      label: 'PowerShell runtime',
      status: 'warning',
      detail: `Detected ${result.runtime.label} ${result.runtime.version} (${result.runtime.edition}). Windows PowerShell 5.1 was not found; current backend targets Windows PowerShell 5.1 as the default runtime.`,
    };
  }

  if (result.kind === 'unsupported-host' || result.kind === 'probe-error') {
    return {
      id: 'powershell',
      label: 'PowerShell runtime',
      status: 'warning',
      detail: result.detail,
    };
  }

  return {
    id: 'powershell',
    label: 'PowerShell runtime',
    status: 'missing',
    detail: result.detail,
  };
}

function mapExchangeModuleCheck(
  result: Awaited<ReturnType<typeof inspectLocalPowerShellEnvironment>>,
): BootstrapCheck {
  if (result.kind === 'detected') {
    if (result.runtime.exchangeModule) {
      if (result.runtime.exchangeModule.import?.importable === false) {
        return {
          id: 'exchangeModule',
          label: 'Exchange module',
          status: 'warning',
          detail: `ExchangeOnlineManagement ${result.runtime.exchangeModule.version} is installed at ${result.runtime.exchangeModule.moduleBase} but could not be imported: ${result.runtime.exchangeModule.import.error ?? 'unknown import error'}.`,
        };
      }

      return {
        id: 'exchangeModule',
        label: 'Exchange module',
        status: result.runtime.command === 'powershell.exe' ? 'ready' : 'warning',
        detail:
          result.runtime.command === 'powershell.exe'
            ? `ExchangeOnlineManagement ${result.runtime.exchangeModule.version} is available at ${result.runtime.exchangeModule.moduleBase}.`
            : `ExchangeOnlineManagement ${result.runtime.exchangeModule.version} is available at ${result.runtime.exchangeModule.moduleBase}, but only the PowerShell 7 runtime was detected.`,
      };
    }

    return {
      id: 'exchangeModule',
      label: 'Exchange module',
      status: 'missing',
      detail: 'ExchangeOnlineManagement was not found in the detected PowerShell module path.',
    };
  }

  if (result.kind === 'unsupported-host' || result.kind === 'probe-error') {
    return {
      id: 'exchangeModule',
      label: 'Exchange module',
      status: 'warning',
      detail: `Exchange module check skipped: ${result.detail}`,
    };
  }

  return {
    id: 'exchangeModule',
    label: 'Exchange module',
    status: 'missing',
    detail: 'Exchange module check could not run because no supported PowerShell runtime was found.',
  };
}

export async function getLocalBootstrapChecks(): Promise<BootstrapCheck[]> {
  const [powerShellInspection, logDirectory, tenantConfig] = await Promise.all([
    inspectLocalPowerShellEnvironment(),
    checkLogDirectoryReadiness(),
    checkTenantConfigPresence(),
  ]);

  return [
    mapPowerShellCheck(powerShellInspection),
    mapExchangeModuleCheck(powerShellInspection),
    {
      id: 'logDirectory',
      label: 'Log directory',
      status: logDirectory.status,
      detail: logDirectory.detail,
    },
    {
      id: 'tenantConfig',
      label: 'Tenant configuration',
      status: tenantConfig.status,
      detail: tenantConfig.detail,
    },
  ];
}
