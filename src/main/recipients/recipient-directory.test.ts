import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/main/exchange/search-recipients', () => ({
  searchExchangeRecipients: vi.fn(),
}));

vi.mock('@/main/graph/search-guest-users', () => ({
  searchGuestUsers: vi.fn(),
}));

vi.mock('@/main/graph/get-graph-connection-status', () => ({
  getGraphConnectionStatus: vi.fn(),
}));

import { searchExchangeRecipients } from '@/main/exchange/search-recipients';
import { getGraphConnectionStatus } from '@/main/graph/get-graph-connection-status';
import { searchGuestUsers } from '@/main/graph/search-guest-users';

import { recipientDirectory } from './recipient-directory';

describe('recipientDirectory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Exchange results unchanged when guestUser is not requested', async () => {
    vi.mocked(searchExchangeRecipients).mockResolvedValue({
      query: 'ja',
      appliedLimit: 25,
      appliedTypes: ['mailbox'],
      sourceStatus: {
        exchange: 'searched',
        graph: 'skipped',
      },
      items: [],
    });
    vi.mocked(getGraphConnectionStatus).mockResolvedValue({
      state: 'disconnected',
      detail: 'Graph session is not connected.',
      authMethod: null,
      configuredTenantId: 'tenant-configured',
      tenantId: null,
      tenantDisplayName: null,
      accountUsername: null,
      accountDisplayName: null,
      tokenExpiresOnUtc: null,
      exchangeAlignment: 'unknown',
    });

    const result = await recipientDirectory.searchRecipients({
      query: 'ja',
      limit: 25,
      types: ['mailbox'],
    });

    expect(result.sourceStatus.graph).toBe('skipped');
    expect(recipientDirectory.getCachedRecipientByStableKey('exchange:objectId:recipient-1')).toBeNull();
  });

  it('merges guest search results when guestUser is requested', async () => {
    vi.mocked(searchExchangeRecipients).mockResolvedValue({
      query: 'ja',
      appliedLimit: 25,
      appliedTypes: ['mailbox'],
      sourceStatus: {
        exchange: 'searched',
        graph: 'skipped',
      },
      items: [
        {
          source: 'exchange',
          stableKey: 'exchange:objectId:recipient-1',
          recipientType: 'mailContact',
          membershipSupport: 'exchangeDirect',
          objectId: 'recipient-1',
          exchangeIdentity: 'contact-1',
          primaryEmail: 'contact@example.com',
          displayName: 'Contact Example',
          alias: 'cexample',
          recipientTypeDetails: 'MailContact',
          companyName: 'Example Corp',
          companySource: 'exchange',
        },
      ],
    });
    vi.mocked(getGraphConnectionStatus).mockResolvedValue({
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
    vi.mocked(searchGuestUsers).mockResolvedValue({
      query: 'ja',
      appliedLimit: 25,
      items: [
        {
          stableKey: 'graph:objectId:guest-1',
          objectId: 'guest-1',
          displayName: 'Guest Example',
          primaryEmail: 'guest@example.com',
          userPrincipalName: 'guest_example.com#EXT#@tenant.onmicrosoft.com',
          companyName: null,
          externalUserState: 'Accepted',
        },
      ],
    });

    const result = await recipientDirectory.searchRecipients({
      query: 'ja',
      limit: 25,
      types: ['mailbox', 'guestUser'],
    });

    expect(result.sourceStatus.graph).toBe('searched');
    expect(result.items.some((item) => item.source === 'graph' && item.membershipSupport === 'graphBridgeable')).toBe(true);
    expect(recipientDirectory.getCachedRecipientByStableKey('graph:objectId:guest-1')?.recipientType).toBe('guestUser');
    expect(recipientDirectory.getCachedRecipientByStableKey('exchange:objectId:recipient-1')?.recipientType).toBe('mailContact');
  });

  it('defers Graph guests when tenant alignment mismatches Exchange', async () => {
    vi.mocked(searchExchangeRecipients).mockResolvedValue({
      query: 'ja',
      appliedLimit: 25,
      appliedTypes: ['mailbox'],
      sourceStatus: {
        exchange: 'searched',
        graph: 'skipped',
      },
      items: [],
    });
    vi.mocked(getGraphConnectionStatus).mockResolvedValue({
      state: 'connected',
      detail: 'Connected to Microsoft Graph.',
      authMethod: 'interactiveBrowser',
      configuredTenantId: 'tenant-configured',
      tenantId: 'tenant-configured',
      tenantDisplayName: 'Example Tenant',
      accountUsername: 'admin@example.com',
      accountDisplayName: 'Admin Example',
      tokenExpiresOnUtc: '2026-04-02T00:00:00.000Z',
      exchangeAlignment: 'mismatched',
    });

    const result = await recipientDirectory.searchRecipients({
      query: 'ja',
      limit: 25,
      types: ['mailbox', 'guestUser'],
    });

    expect(result.sourceStatus.graph).toBe('deferred');
    expect(result.sourceFailures?.graph?.classification.category).toBe('tenantMismatch');
    expect(result.items).toHaveLength(0);
    expect(searchGuestUsers).not.toHaveBeenCalled();
  });

  it('preserves graph source failure detail when guest search degrades after exchange results', async () => {
    vi.mocked(searchExchangeRecipients).mockResolvedValue({
      query: 'ja',
      appliedLimit: 25,
      appliedTypes: ['mailbox'],
      sourceStatus: {
        exchange: 'searched',
        graph: 'skipped',
      },
      items: [
        {
          source: 'exchange',
          stableKey: 'exchange:objectId:recipient-1',
          recipientType: 'mailContact',
          membershipSupport: 'exchangeDirect',
          objectId: 'recipient-1',
          exchangeIdentity: 'contact-1',
          primaryEmail: 'contact@example.com',
          displayName: 'Contact Example',
          alias: 'cexample',
          recipientTypeDetails: 'MailContact',
          companyName: 'Example Corp',
          companySource: 'exchange',
        },
      ],
    });
    vi.mocked(getGraphConnectionStatus).mockResolvedValue({
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
    vi.mocked(searchGuestUsers).mockRejectedValue(
      Object.assign(new Error('Microsoft Graph request failed with 403 Forbidden.'), {
        statusCode: 403,
        backendCode: 'Authorization_RequestDenied',
      }),
    );

    const result = await recipientDirectory.searchRecipients({
      query: 'ja',
      limit: 25,
      types: ['mailbox', 'guestUser'],
    });

    expect(result.sourceStatus.graph).toBe('unavailable');
    expect(result.sourceFailures?.graph).toMatchObject({
      classification: {
        category: 'authorizationFailure',
        backend: 'graph',
      },
    });
    expect(result.items).toHaveLength(1);
  });

  it('returns null for uncached stable keys', () => {
    expect(recipientDirectory.getCachedRecipientByStableKey('missing:key')).toBeNull();
  });

  it('tags Exchange failures so composite search classification keeps the Exchange backend', async () => {
    vi.mocked(searchExchangeRecipients).mockRejectedValue(
      new Error('Exchange session host is not running. Connect to Exchange Online first.'),
    );

    await expect(
      recipientDirectory.searchRecipients({
        query: 'ja',
        limit: 25,
        types: ['mailbox', 'guestUser'],
      }),
    ).rejects.toMatchObject({
      backendOwner: 'exchange',
    });
  });

  it('tags graph failures when guest search is the only requested source', async () => {
    vi.mocked(getGraphConnectionStatus).mockResolvedValue({
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
    vi.mocked(searchGuestUsers).mockRejectedValue(new Error('Graph token acquisition failed.'));

    await expect(
      recipientDirectory.searchRecipients({
        query: 'ja',
        limit: 25,
        types: ['guestUser'],
      }),
    ).rejects.toMatchObject({
      backendOwner: 'graph',
    });
  });

  it('preserves classified graph status failures during partial composite search results', async () => {
    vi.mocked(searchExchangeRecipients).mockResolvedValue({
      query: 'ja',
      appliedLimit: 25,
      appliedTypes: ['mailbox'],
      sourceStatus: {
        exchange: 'searched',
        graph: 'skipped',
      },
      items: [
        {
          source: 'exchange',
          stableKey: 'exchange:objectId:recipient-1',
          recipientType: 'mailbox',
          membershipSupport: 'exchangeDirect',
          objectId: 'recipient-1',
          exchangeIdentity: 'recipient-1',
          primaryEmail: 'jane@example.com',
          displayName: 'Jane Example',
          alias: 'jexample',
          recipientTypeDetails: 'UserMailbox',
          companyName: 'Example Corp',
          companySource: 'exchange',
        },
      ],
    });
    vi.mocked(getGraphConnectionStatus).mockResolvedValue({
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

    const result = await recipientDirectory.searchRecipients({
      query: 'ja',
      limit: 25,
      types: ['mailbox', 'guestUser'],
    });

    expect(result.items).toHaveLength(1);
    expect(result.sourceFailures?.graph?.classification.category).toBe('authorizationFailure');
    expect(result.sourceFailures?.graph?.classification.backendCode).toBe('Authorization_RequestDenied');
  });
});
