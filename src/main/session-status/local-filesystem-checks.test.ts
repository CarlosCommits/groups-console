import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('@/main/app/paths', () => ({
  getGroupsConsoleLogDirectory: () => '/tmp/logs',
  getGroupsConsoleTenantConfigPath: () => '/tmp/tenant.json',
  getGroupsConsoleDevTenantConfigPath: () => '/repo/config/tenant.json',
}));

vi.mock('@/main/app/runtime-mode', () => ({
  isPackagedRuntime: vi.fn(() => false),
}));

import { access, readFile } from 'node:fs/promises';

import { isPackagedRuntime } from '@/main/app/runtime-mode';

import { checkTenantConfigPresence } from './local-filesystem-checks';

describe('checkTenantConfigPresence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isPackagedRuntime).mockReturnValue(false);
  });

  it('uses the primary tenant config path when it exists', async () => {
    vi.mocked(access).mockResolvedValue(undefined);
    vi.mocked(readFile).mockResolvedValue('{"tenantId":"tenant","graph":{"clientId":"id","redirectUri":"https://example.com","inviteRedirectUrl":"https://example.com/invite"}}');

    const result = await checkTenantConfigPresence();

    expect(result.status).toBe('ready');
    expect(result.detail).toContain('/tmp/tenant.json');
  });

  it('falls back to the repo-local config in development when the primary file is missing', async () => {
    vi.mocked(access)
      .mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }))
      .mockResolvedValueOnce(undefined);
    vi.mocked(readFile).mockResolvedValue('{"tenantId":"tenant","graph":{"clientId":"id","redirectUri":"https://example.com","inviteRedirectUrl":"https://example.com/invite"}}');

    const result = await checkTenantConfigPresence();

    expect(result.status).toBe('ready');
    expect(result.detail).toContain('/repo/config/tenant.json');
  });

  it('does not use the dev fallback in packaged runtime', async () => {
    vi.mocked(isPackagedRuntime).mockReturnValue(true);
    vi.mocked(access).mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }));

    const result = await checkTenantConfigPresence();

    expect(result.status).toBe('missing');
    expect(result.detail).toContain('/tmp/tenant.json');
  });
});
