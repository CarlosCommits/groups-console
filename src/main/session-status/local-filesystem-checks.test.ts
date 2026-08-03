import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('@/main/app/paths', () => ({
  getGroupsConsoleBundledTenantConfigPath: () => '/resources/config/tenant.json',
  getGroupsConsoleLogDirectory: () => '/tmp/logs',
  getGroupsConsoleTenantConfigPath: () => '/tmp/tenant.json',
}));

import { access, readFile } from 'node:fs/promises';

import { checkTenantConfigPresence } from './local-filesystem-checks';

describe('checkTenantConfigPresence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the primary tenant config path when it exists', async () => {
    vi.mocked(access).mockResolvedValue(undefined);
    vi.mocked(readFile).mockResolvedValue('{"graph":{"clientId":"11111111-1111-4111-8111-111111111111","authorityTenant":"organizations","inviteRedirectUrl":"https://example.com/invite"}}');

    const result = await checkTenantConfigPresence();

    expect(result.status).toBe('ready');
    expect(result.detail).toContain('/tmp/tenant.json');
  });

  it('falls back to the bundled config when the primary file is missing', async () => {
    vi.mocked(access)
      .mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }))
      .mockResolvedValueOnce(undefined);
    vi.mocked(readFile).mockResolvedValue('{"graph":{"clientId":"11111111-1111-4111-8111-111111111111","authorityTenant":"organizations","inviteRedirectUrl":"https://example.com/invite"}}');

    const result = await checkTenantConfigPresence();

    expect(result.status).toBe('ready');
    expect(result.detail).toContain('/resources/config/tenant.json');
  });

  it('uses the bundled config fallback in packaged runtime when the primary file is missing', async () => {
    vi.mocked(access)
      .mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }))
      .mockResolvedValueOnce(undefined);
    vi.mocked(readFile).mockResolvedValue('{"graph":{"clientId":"11111111-1111-4111-8111-111111111111","authorityTenant":"organizations","inviteRedirectUrl":"https://example.com/invite"}}');

    const result = await checkTenantConfigPresence();

    expect(result.status).toBe('ready');
    expect(result.detail).toContain('/resources/config/tenant.json');
  });

  it('warns before sign-in when the Graph client ID is the nil GUID placeholder', async () => {
    vi.mocked(access).mockResolvedValue(undefined);
    vi.mocked(readFile).mockResolvedValue('{"graph":{"clientId":"00000000-0000-0000-0000-000000000000","authorityTenant":"organizations","inviteRedirectUrl":"https://example.com/invite"}}');

    const result = await checkTenantConfigPresence();

    expect(result.status).toBe('warning');
    expect(result.detail).toContain('nil GUID placeholder');
  });
});
