import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('@/main/app/paths', () => ({
  getGroupsConsoleBundledTenantConfigPath: () => '/resources/config/tenant.json',
  getGroupsConsoleTenantConfigPath: () => '/tmp/tenant.json',
}));

import { access, readFile } from 'node:fs/promises';

import { loadTenantConfig } from './tenant-config';

const validTenantConfig = JSON.stringify({
  graph: {
    clientId: 'client-id',
    authorityTenant: 'organizations',
    inviteRedirectUrl: 'https://example.com/invite-complete',
  },
});

describe('loadTenantConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('reads the primary AppData tenant config when available', async () => {
    vi.mocked(access).mockResolvedValue(undefined);
    vi.mocked(readFile).mockResolvedValue(validTenantConfig);

    const result = await loadTenantConfig();

    expect(result.graph.clientId).toBe('client-id');
    expect(vi.mocked(readFile)).toHaveBeenCalledWith('/tmp/tenant.json', 'utf8');
  });

  it('falls back to the bundled tenant config when AppData config is missing', async () => {
    vi.mocked(access)
      .mockRejectedValueOnce(Object.assign(new Error('missing primary'), { code: 'ENOENT' }))
      .mockResolvedValueOnce(undefined);
    vi.mocked(readFile).mockResolvedValue(validTenantConfig);

    const result = await loadTenantConfig();

    expect(result.graph.clientId).toBe('client-id');
    expect(vi.mocked(readFile)).toHaveBeenCalledWith('/resources/config/tenant.json', 'utf8');
  });

  it('uses the bundled config fallback in packaged runtime when AppData config is missing', async () => {
    const missingPrimary = Object.assign(new Error('missing primary'), { code: 'ENOENT' });
    vi.mocked(access)
      .mockRejectedValueOnce(missingPrimary)
      .mockResolvedValueOnce(undefined);
    vi.mocked(readFile).mockResolvedValue(validTenantConfig);

    const result = await loadTenantConfig();

    expect(result.graph.clientId).toBe('client-id');
    expect(vi.mocked(readFile)).toHaveBeenCalledWith('/resources/config/tenant.json', 'utf8');
  });

  it('does not use the dev fallback for non-missing primary path errors', async () => {
    const permissionError = Object.assign(new Error('permission denied'), { code: 'EACCES' });
    vi.mocked(access).mockRejectedValueOnce(permissionError);

    await expect(loadTenantConfig()).rejects.toThrow('permission denied');
    expect(vi.mocked(readFile)).not.toHaveBeenCalled();
  });

  it('parses the expected tenant config shape', async () => {
    vi.mocked(access).mockResolvedValue(undefined);
    vi.mocked(readFile).mockResolvedValue(validTenantConfig);

    const result = await loadTenantConfig();

    expect(result.graph.clientId).toBe('client-id');
    expect(result.tenantId).toBeUndefined();
  });

  it('still accepts a legacy tenant-pinned config', async () => {
    vi.mocked(access).mockResolvedValue(undefined);
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      tenantId: 'tenant-configured',
      graph: {
        clientId: 'client-id',
        inviteRedirectUrl: 'https://example.com/invite-complete',
      },
    }));

    const result = await loadTenantConfig();

    expect(result.tenantId).toBe('tenant-configured');
  });
});
