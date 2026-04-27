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

  it('accepts an error graph connection status with classification metadata', () => {
    const result = graphConnectionStatusSchema.parse({
      state: 'error',
      detail: 'Microsoft Graph request failed with 403 Forbidden.',
      authMethod: null,
      configuredTenantId: 'tenant-configured',
      tenantId: null,
      tenantDisplayName: null,
      accountUsername: null,
      accountDisplayName: null,
      tokenExpiresOnUtc: null,
      exchangeAlignment: 'unknown',
      failureClassification: {
        category: 'authorizationFailure',
        remediation: 'verifyPermissions',
        backend: 'graph',
        operation: 'graph.getConnectionStatus',
        guidance: 'Verify Microsoft Graph admin consent before retrying.',
        statusCode: 403,
        backendCode: 'Authorization_RequestDenied',
      },
    });

    expect(result.failureClassification?.category).toBe('authorizationFailure');
  });

  it('accepts the tenant config shape', () => {
    const result = tenantConfigSchema.parse({
      graph: {
        clientId: 'client-id',
        inviteRedirectUrl: 'https://example.com/invite-complete',
        authorityHost: 'https://login.microsoftonline.com',
        authorityTenant: 'organizations',
        scopes: ['User.Read', 'User.Read.All', 'User.Invite.All'],
      },
    });

    expect(result.graph.clientId).toBe('client-id');
    expect(result.tenantId).toBeUndefined();
  });

  it('accepts optional tenant allowlisting', () => {
    const result = tenantConfigSchema.parse({
      graph: {
        clientId: 'client-id',
        inviteRedirectUrl: 'https://example.com/invite-complete',
        authorityTenant: 'organizations',
        allowedTenantIds: ['tenant-a', 'tenant-b'],
      },
    });

    expect(result.graph.allowedTenantIds).toEqual(['tenant-a', 'tenant-b']);
  });
});
