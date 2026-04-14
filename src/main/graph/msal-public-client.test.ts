import type { IPublicClientApplication } from '@azure/msal-node';
import { describe, expect, it, vi } from 'vitest';

const { openExternal } = vi.hoisted(() => ({
  openExternal: vi.fn(),
}));

vi.mock('electron', () => ({
  shell: {
    openExternal,
  },
}));

import { acquireInteractiveGraphToken } from './msal-public-client';

describe('acquireInteractiveGraphToken', () => {
  it('uses the msal loopback flow without an explicit redirect URI', async () => {
    const acquireTokenInteractive = vi
      .fn<IPublicClientApplication['acquireTokenInteractive']>()
      .mockResolvedValue({ accessToken: 'graph-token' } as never);
    const publicClient = {
      acquireTokenInteractive,
    };

    await acquireInteractiveGraphToken(publicClient as never, {
      tenantId: 'tenant-configured',
      graph: {
        clientId: 'client-id',
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
