import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('@/main/app/paths', () => ({
  getRadAppTenantConfigPath: () => '/tmp/tenant.json',
  getRadAppDevTenantConfigPath: () => '/repo/config/tenant.json',
}));

vi.mock('@/main/app/runtime-mode', () => ({
  isPackagedRuntime: vi.fn(() => false),
}));

import { access, readFile } from 'node:fs/promises';

import { loadTenantConfig } from './tenant-config';
import { isPackagedRuntime } from '@/main/app/runtime-mode';

const validTenantConfig = JSON.stringify({
  tenantId: 'tenant-configured',
  graph: {
    clientId: 'client-id',
    redirectUri: 'msalclientid://auth',
    inviteRedirectUrl: 'https://example.com/invite-complete',
  },
});

describe('loadTenantConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(isPackagedRuntime).mockReturnValue(false);
  });

  it('reads the primary AppData tenant config when available', async () => {
    vi.mocked(access).mockResolvedValue(undefined);
    vi.mocked(readFile).mockResolvedValue(validTenantConfig);

    const result = await loadTenantConfig();

    expect(result.graph.clientId).toBe('client-id');
    expect(vi.mocked(readFile)).toHaveBeenCalledWith('/tmp/tenant.json', 'utf8');
  });

  it('falls back to the repo-local tenant config in development when AppData config is missing', async () => {
    vi.mocked(isPackagedRuntime).mockReturnValue(false);
    vi.mocked(access)
      .mockRejectedValueOnce(Object.assign(new Error('missing primary'), { code: 'ENOENT' }))
      .mockResolvedValueOnce(undefined);
    vi.mocked(readFile).mockResolvedValue(validTenantConfig);

    const result = await loadTenantConfig();

    expect(result.graph.clientId).toBe('client-id');
    expect(vi.mocked(readFile)).toHaveBeenCalledWith('/repo/config/tenant.json', 'utf8');
  });

  it('does not use the dev fallback in packaged runtime', async () => {
    const missingPrimary = Object.assign(new Error('missing primary'), { code: 'ENOENT' });
    vi.mocked(isPackagedRuntime).mockReturnValue(true);
    vi.mocked(access).mockRejectedValueOnce(missingPrimary);

    await expect(loadTenantConfig()).rejects.toThrow('missing primary');
    expect(vi.mocked(readFile)).not.toHaveBeenCalled();
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
  });
});
