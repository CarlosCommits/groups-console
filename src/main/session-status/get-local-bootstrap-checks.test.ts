import { describe, expect, it, vi } from 'vitest';

import { getLocalBootstrapChecks } from './get-local-bootstrap-checks';

vi.mock('./powershell-inspection', () => ({
  inspectLocalPowerShellEnvironment: vi.fn(),
}));

vi.mock('./local-filesystem-checks', () => ({
  checkLogDirectoryReadiness: vi.fn(),
  checkTenantConfigPresence: vi.fn(),
}));

import { inspectLocalPowerShellEnvironment } from './powershell-inspection';
import {
  checkLogDirectoryReadiness,
  checkTenantConfigPresence,
} from './local-filesystem-checks';

describe('getLocalBootstrapChecks', () => {
  it('maps a preferred runtime and Exchange module to ready checks', async () => {
    vi.mocked(inspectLocalPowerShellEnvironment).mockResolvedValue({
      kind: 'detected',
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
        version: '5.1.19041.1',
        edition: 'Desktop',
        executionPolicy: 'RemoteSigned',
        executionPolicies: [],
        exchangeModule: {
          name: 'ExchangeOnlineManagement',
          version: '3.9.0',
          moduleBase: 'C:/Users/test/Documents/WindowsPowerShell/Modules/ExchangeOnlineManagement',
        },
      },
    });
    vi.mocked(checkLogDirectoryReadiness).mockResolvedValue({
      status: 'ready',
      detail: 'Log dir ready.',
    });
    vi.mocked(checkTenantConfigPresence).mockResolvedValue({
      status: 'missing',
      detail: 'Tenant config missing.',
    });

    const checks = await getLocalBootstrapChecks();

    expect(checks.map((check) => check.id)).toEqual([
      'powershell',
      'exchangeModule',
      'logDirectory',
      'tenantConfig',
    ]);
    expect(checks[0]?.status).toBe('ready');
    expect(checks[1]?.status).toBe('ready');
    expect(checks[3]?.status).toBe('missing');
  });

  it('degrades to missing Exchange readiness when no runtime is available', async () => {
    vi.mocked(inspectLocalPowerShellEnvironment).mockResolvedValue({
      kind: 'missing-runtime',
      detail: 'No supported PowerShell runtime executable was found on this Windows host.',
    });
    vi.mocked(checkLogDirectoryReadiness).mockResolvedValue({
      status: 'ready',
      detail: 'Log dir ready.',
    });
    vi.mocked(checkTenantConfigPresence).mockResolvedValue({
      status: 'warning',
      detail: 'Tenant config is empty.',
    });

    const checks = await getLocalBootstrapChecks();

    expect(checks[0]?.status).toBe('missing');
    expect(checks[1]?.status).toBe('missing');
    expect(checks[2]?.status).toBe('ready');
    expect(checks[3]?.status).toBe('warning');
  });
});
