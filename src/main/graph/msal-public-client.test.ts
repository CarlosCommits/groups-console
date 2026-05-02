import type { IPublicClientApplication } from '@azure/msal-node';
import { describe, expect, it, vi } from 'vitest';

const { openExternal, publicClientApplication } = vi.hoisted(() => ({
  openExternal: vi.fn(),
  publicClientApplication: vi.fn(),
}));

vi.mock('electron', () => ({
  shell: {
    openExternal,
  },
}));

vi.mock('@azure/msal-node', () => ({
  PublicClientApplication: publicClientApplication,
}));

vi.mock('./graph-auth-cache', () => ({
  createElectronMsalCachePlugin: vi.fn(() => undefined),
}));

import { acquireInteractiveGraphToken, createGraphPublicClient } from './msal-public-client';

describe('createGraphPublicClient', () => {
  it('uses the organizations authority for multi-tenant configs', () => {
    createGraphPublicClient({
      graph: {
        clientId: 'client-id',
        authorityTenant: 'organizations',
        inviteRedirectUrl: 'https://example.com/invite-complete',
      },
    });

    expect(publicClientApplication).toHaveBeenCalledWith({
      auth: {
        clientId: 'client-id',
        authority: 'https://login.microsoftonline.com/organizations',
      },
    });
  });

  it('keeps legacy tenant-pinned configs pinned to their tenant authority', () => {
    createGraphPublicClient({
      tenantId: 'tenant-configured',
      graph: {
        clientId: 'client-id',
        inviteRedirectUrl: 'https://example.com/invite-complete',
      },
    });

    expect(publicClientApplication).toHaveBeenCalledWith({
      auth: {
        clientId: 'client-id',
        authority: 'https://login.microsoftonline.com/tenant-configured',
      },
    });
  });
});

describe('acquireInteractiveGraphToken', () => {
  it('uses the msal loopback flow without an explicit redirect URI', async () => {
    const acquireTokenInteractive = vi
      .fn<IPublicClientApplication['acquireTokenInteractive']>()
      .mockResolvedValue({ accessToken: 'graph-token' } as never);
    const publicClient = {
      acquireTokenInteractive,
    };

    await acquireInteractiveGraphToken(publicClient as never, {
      graph: {
        clientId: 'client-id',
        authorityTenant: 'organizations',
        inviteRedirectUrl: 'https://example.com/invite-complete',
      },
    });

    expect(acquireTokenInteractive).toHaveBeenCalledTimes(1);

    const request = vi.mocked(acquireTokenInteractive).mock.calls[0]?.[0];

    expect(request).toBeDefined();
    expect(request).not.toHaveProperty('redirectUri');

    if (!request?.openBrowser) {
      throw new Error('Expected interactive request to include an openBrowser callback.');
    }

    await request.openBrowser('https://example.com/auth');
    expect(openExternal).toHaveBeenCalledWith('https://example.com/auth');
  });
});
