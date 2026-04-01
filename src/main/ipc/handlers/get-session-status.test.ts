import { describe, expect, it, vi } from 'vitest';

import { sessionStatusSchema } from '@/shared/contracts/session';

vi.mock('electron', () => ({
  app: {
    getVersion: () => '0.1.0-test',
  },
}));

vi.mock('@/main/session-status/get-local-bootstrap-checks', () => ({
  getLocalBootstrapChecks: vi.fn(),
}));

import { getLocalBootstrapChecks } from '@/main/session-status/get-local-bootstrap-checks';

import { getSessionStatus } from './get-session-status';

describe('getSessionStatus', () => {
  it('returns a schema-safe session status payload', async () => {
    vi.mocked(getLocalBootstrapChecks).mockResolvedValue([
      {
        id: 'powershell',
        label: 'PowerShell runtime',
        status: 'warning',
        detail: 'Runtime check not completed.',
      },
      {
        id: 'exchangeModule',
        label: 'Exchange module',
        status: 'missing',
        detail: 'Module missing.',
      },
      {
        id: 'logDirectory',
        label: 'Log directory',
        status: 'ready',
        detail: 'Log dir ready.',
      },
      {
        id: 'tenantConfig',
        label: 'Tenant configuration',
        status: 'missing',
        detail: 'Tenant config missing.',
      },
    ]);

    const result = await getSessionStatus();

    expect(() => sessionStatusSchema.parse(result)).not.toThrow();
    expect(result.checks).toHaveLength(4);
  });
});
