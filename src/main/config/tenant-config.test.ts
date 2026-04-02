import { describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  access: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn(),
}));

vi.mock('@/main/app/paths', () => ({
  getRadAppTenantConfigPath: () => '/tmp/tenant.json',
}));

import { readFile } from 'node:fs/promises';

import { loadTenantConfig } from './tenant-config';

describe('loadTenantConfig', () => {
  it('parses the expected tenant config shape', async () => {
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({
        tenantId: 'tenant-configured',
        graph: {
          clientId: 'client-id',
          redirectUri: 'msalclientid://auth',
          inviteRedirectUrl: 'https://example.com/invite-complete',
        },
      }),
    );

    const result = await loadTenantConfig();

    expect(result.graph.clientId).toBe('client-id');
  });
});
