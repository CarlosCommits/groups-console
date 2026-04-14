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
    expect(result.items[0]?.source).toBe('graph');
    expect(result.items[0]?.membershipSupport).toBe('graphBridgeable');
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
    expect(result.items).toHaveLength(0);
    expect(searchGuestUsers).not.toHaveBeenCalled();
  });
});
