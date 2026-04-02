import { describe, expect, it } from 'vitest';

import {
  graphConnectionStatusSchema,
  tenantConfigSchema,
} from './graph';

describe('graph contracts', () => {
  it('accepts a graph connection status payload', () => {
    const result = graphConnectionStatusSchema.parse({
      state: 'connected',
      detail: 'Connected to Microsoft Graph.',
      authMethod: 'interactiveBrowser',
      configuredTenantId: 'tenant-configured',
      tenantId: 'tenant-configured',
      tenantDisplayName: 'Example Tenant',
      accountUsername: 'admin@example.com',
      accountDisplayName: 'Admin Example',
      tokenExpiresOnUtc: '2026-04-02T00:00:00.000Z',
      exchangeAlignment: 'matched',
    });

    expect(result.state).toBe('connected');
  });

  it('accepts the tenant config shape', () => {
    const result = tenantConfigSchema.parse({
      tenantId: 'tenant-configured',
      graph: {
        clientId: 'client-id',
        redirectUri: 'msalclientid://auth',
        inviteRedirectUrl: 'https://example.com/invite-complete',
        authorityHost: 'https://login.microsoftonline.com',
        scopes: ['User.Read', 'User.Read.All', 'User.Invite.All'],
      },
    });

    expect(result.graph.clientId).toBe('client-id');
  });
});
