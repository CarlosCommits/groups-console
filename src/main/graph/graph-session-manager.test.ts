import { describe, expect, it, vi } from 'vitest';

vi.mock('@/main/config/tenant-config', () => ({
  loadTenantConfig: vi.fn(),
}));

vi.mock('./msal-public-client', () => ({
  createGraphPublicClient: vi.fn(),
  acquireInteractiveGraphToken: vi.fn(),
  acquireSilentGraphToken: vi.fn(),
  signOutGraphAccount: vi.fn(),
}));

vi.mock('./graph-client', () => ({
  fetchGraphOrganization: vi.fn(),
  fetchGraphMe: vi.fn(),
  getGraphGuestById: vi.fn(),
  searchGraphGuests: vi.fn(),
  inviteGraphGuest: vi.fn(),
  updateGraphGuestCompany: vi.fn(),
}));

vi.mock('@/main/exchange/get-exchange-connection-status', () => ({
  getExchangeConnectionStatus: vi.fn(),
}));

import { loadTenantConfig } from '@/main/config/tenant-config';
import { getExchangeConnectionStatus } from '@/main/exchange/get-exchange-connection-status';

import {
  fetchGraphMe,
  fetchGraphOrganization,
  getGraphGuestById,
  inviteGraphGuest,
  searchGraphGuests,
  updateGraphGuestCompany,
} from './graph-client';
import {
  acquireInteractiveGraphToken,
  acquireSilentGraphToken,
  createGraphPublicClient,
  signOutGraphAccount,
} from './msal-public-client';
import { GraphSessionManager } from './graph-session-manager';

describe('GraphSessionManager', () => {
  const tenantConfig = {
    tenantId: 'tenant-configured',
    graph: {
      clientId: 'client-id',
      inviteRedirectUrl: 'https://example.com/invite-complete',
    },
  };

  it('connects with tenant pinning and returns matched status', async () => {
    const manager = new GraphSessionManager();
    const publicClient = { kind: 'msal' };
    vi.mocked(loadTenantConfig).mockResolvedValue(tenantConfig);
    vi.mocked(createGraphPublicClient).mockReturnValue(publicClient as never);
    vi.mocked(acquireInteractiveGraphToken).mockResolvedValue({
      account: {
        tenantId: 'tenant-configured',
        username: 'admin@example.com',
        name: 'Admin Example',
      },
      accessToken: 'token-1',
      expiresOn: new Date('2026-04-02T00:00:00.000Z'),
    } as never);
    vi.mocked(fetchGraphOrganization).mockResolvedValue({
      id: 'tenant-configured',
      displayName: 'Example Tenant',
    });
    vi.mocked(fetchGraphMe).mockResolvedValue({
      id: 'me-1',
      displayName: 'Admin Example',
      userPrincipalName: 'admin@example.com',
    });
    vi.mocked(acquireSilentGraphToken).mockResolvedValue({
      accessToken: 'token-2',
      expiresOn: new Date('2026-04-02T00:00:00.000Z'),
    } as never);
    vi.mocked(getExchangeConnectionStatus).mockResolvedValue({
      state: 'connected',
      detail: 'Connected to Exchange Online.',
      runtime: null,
      userPrincipalName: 'admin@example.com',
      connectionId: 'conn-1',
      tenantId: 'tenant-configured',
      tokenStatus: 'Active',
      tokenExpiryTimeUtc: null,
      connectedAtUtc: null,
    });

    const result = await manager.connect();

    expect(result.state).toBe('connected');
    expect(result.exchangeAlignment).toBe('matched');
  });

  it('returns error on tenant mismatch and signs out the account', async () => {
    const manager = new GraphSessionManager();
    const publicClient = { kind: 'msal' };
    const account = {
      tenantId: 'tenant-other',
      username: 'admin@example.com',
      name: 'Admin Example',
    };

    vi.mocked(loadTenantConfig).mockResolvedValue(tenantConfig);
    vi.mocked(createGraphPublicClient).mockReturnValue(publicClient as never);
    vi.mocked(acquireInteractiveGraphToken).mockResolvedValue({
      account,
      accessToken: 'token-1',
      expiresOn: new Date('2026-04-02T00:00:00.000Z'),
    } as never);
    vi.mocked(fetchGraphOrganization).mockResolvedValue({
      id: 'tenant-other',
      displayName: 'Other Tenant',
    });

    const result = await manager.connect();

    expect(result.state).toBe('error');
    expect(result.detail).toContain('did not match configured tenant');
    expect(signOutGraphAccount).toHaveBeenCalledWith(publicClient, account);
  });

  it('searches guests through the active session', async () => {
    const manager = new GraphSessionManager();
    const publicClient = { kind: 'msal' };
    vi.mocked(loadTenantConfig).mockResolvedValue(tenantConfig);
    vi.mocked(createGraphPublicClient).mockReturnValue(publicClient as never);
    vi.mocked(acquireInteractiveGraphToken).mockResolvedValue({
      account: {
        tenantId: 'tenant-configured',
        username: 'admin@example.com',
        name: 'Admin Example',
      },
      accessToken: 'token-1',
      expiresOn: new Date('2026-04-02T00:00:00.000Z'),
    } as never);
    vi.mocked(fetchGraphOrganization).mockResolvedValue({
      id: 'tenant-configured',
      displayName: 'Example Tenant',
    });
    vi.mocked(fetchGraphMe).mockResolvedValue({
      id: 'me-1',
      displayName: 'Admin Example',
      userPrincipalName: 'admin@example.com',
    });
    vi.mocked(acquireSilentGraphToken).mockResolvedValue({
      accessToken: 'token-2',
      expiresOn: new Date('2026-04-02T00:00:00.000Z'),
    } as never);
    vi.mocked(getExchangeConnectionStatus).mockResolvedValue({
      state: 'disconnected',
      detail: 'Exchange session host is not running.',
      runtime: null,
      userPrincipalName: null,
      connectionId: null,
      tenantId: null,
      tokenStatus: null,
      tokenExpiryTimeUtc: null,
      connectedAtUtc: null,
    });
    vi.mocked(searchGraphGuests).mockResolvedValue({
      query: 'ja',
      appliedLimit: 25,
      items: [],
    });

    await manager.connect();
    const result = await manager.searchGuests({ query: 'ja', limit: 25 });

    expect(result.query).toBe('ja');
    expect(searchGraphGuests).toHaveBeenCalledWith('token-2', { query: 'ja', limit: 25 });
  });

  it('invites a guest through the active session', async () => {
    const manager = new GraphSessionManager();
    const publicClient = { kind: 'msal' };
    vi.mocked(loadTenantConfig).mockResolvedValue(tenantConfig);
    vi.mocked(createGraphPublicClient).mockReturnValue(publicClient as never);
    vi.mocked(acquireInteractiveGraphToken).mockResolvedValue({
      account: {
        tenantId: 'tenant-configured',
        username: 'admin@example.com',
        name: 'Admin Example',
      },
      accessToken: 'token-1',
      expiresOn: new Date('2026-04-02T00:00:00.000Z'),
    } as never);
    vi.mocked(fetchGraphOrganization).mockResolvedValue({
      id: 'tenant-configured',
      displayName: 'Example Tenant',
    });
    vi.mocked(fetchGraphMe).mockResolvedValue({
      id: 'me-1',
      displayName: 'Admin Example',
      userPrincipalName: 'admin@example.com',
    });
    vi.mocked(acquireSilentGraphToken).mockResolvedValue({
      accessToken: 'token-2',
      expiresOn: new Date('2026-04-02T00:00:00.000Z'),
    } as never);
    vi.mocked(getExchangeConnectionStatus).mockResolvedValue({
      state: 'disconnected',
      detail: 'Exchange session host is not running.',
      runtime: null,
      userPrincipalName: null,
      connectionId: null,
      tenantId: null,
      tokenStatus: null,
      tokenExpiryTimeUtc: null,
      connectedAtUtc: null,
    });
    vi.mocked(inviteGraphGuest).mockResolvedValue({
      outcome: 'invited',
      invitationId: 'invite-1',
      invitedUserId: 'guest-1',
      invitedUserEmail: 'guest@example.com',
      invitedUserDisplayName: 'Guest Example',
      invitedUserUserPrincipalName: 'guest_example.com#EXT#@tenant.onmicrosoft.com',
      companyName: null,
      inviteRedeemUrl: 'https://example.com/invite',
      status: 'PendingAcceptance',
      companyUpdate: {
        attempted: false,
        updated: false,
        detail: 'No company update was requested.',
      },
      verification: {
        attempted: true,
        foundGuest: true,
        detail: 'Verified invited guest in Microsoft Graph.',
      },
    });

    await manager.connect();
    const result = await manager.inviteGuest({ email: 'guest@example.com' });

    expect(result.outcome).toBe('invited');
    if (result.outcome !== 'invited') {
      throw new Error('Expected Graph session manager to return an invited guest result.');
    }

    expect(result.invitedUserId).toBe('guest-1');
  });

  it('updates a guest company through the active session', async () => {
    const manager = new GraphSessionManager();
    const publicClient = { kind: 'msal' };
    vi.mocked(loadTenantConfig).mockResolvedValue(tenantConfig);
    vi.mocked(createGraphPublicClient).mockReturnValue(publicClient as never);
    vi.mocked(acquireInteractiveGraphToken).mockResolvedValue({
      account: {
        tenantId: 'tenant-configured',
        username: 'admin@example.com',
        name: 'Admin Example',
      },
      accessToken: 'token-1',
      expiresOn: new Date('2026-04-02T00:00:00.000Z'),
    } as never);
    vi.mocked(fetchGraphOrganization).mockResolvedValue({
      id: 'tenant-configured',
      displayName: 'Example Tenant',
    });
    vi.mocked(fetchGraphMe).mockResolvedValue({
      id: 'me-1',
      displayName: 'Admin Example',
      userPrincipalName: 'admin@example.com',
    });
    vi.mocked(acquireSilentGraphToken).mockResolvedValue({
      accessToken: 'token-2',
      expiresOn: new Date('2026-04-02T00:00:00.000Z'),
    } as never);
    vi.mocked(getExchangeConnectionStatus).mockResolvedValue({
      state: 'disconnected',
      detail: 'Exchange session host is not running.',
      runtime: null,
      userPrincipalName: null,
      connectionId: null,
      tenantId: null,
      tokenStatus: null,
      tokenExpiryTimeUtc: null,
      connectedAtUtc: null,
    });
    vi.mocked(updateGraphGuestCompany).mockResolvedValue({
      guestUserId: 'guest-1',
      companyName: 'Guest Co',
      verification: {
        attempted: true,
        foundGuest: true,
        companyApplied: true,
        detail: 'Verified guest company update.',
      },
    });

    await manager.connect();
    const result = await manager.updateGuestCompany({
      guestUserId: 'guest-1',
      companyName: 'Guest Co',
    });

    expect(result.verification.companyApplied).toBe(true);
  });

  it('reads a guest by object id through the active session', async () => {
    const manager = new GraphSessionManager();
    const publicClient = { kind: 'msal' };
    vi.mocked(loadTenantConfig).mockResolvedValue(tenantConfig);
    vi.mocked(createGraphPublicClient).mockReturnValue(publicClient as never);
    vi.mocked(acquireInteractiveGraphToken).mockResolvedValue({
      account: {
        tenantId: 'tenant-configured',
        username: 'admin@example.com',
        name: 'Admin Example',
      },
      accessToken: 'token-1',
      expiresOn: new Date('2026-04-02T00:00:00.000Z'),
    } as never);
    vi.mocked(fetchGraphOrganization).mockResolvedValue({
      id: 'tenant-configured',
      displayName: 'Example Tenant',
    });
    vi.mocked(fetchGraphMe).mockResolvedValue({
      id: 'me-1',
      displayName: 'Admin Example',
      userPrincipalName: 'admin@example.com',
    });
    vi.mocked(acquireSilentGraphToken).mockResolvedValue({
      accessToken: 'token-2',
      expiresOn: new Date('2026-04-02T00:00:00.000Z'),
    } as never);
    vi.mocked(getExchangeConnectionStatus).mockResolvedValue({
      state: 'connected',
      detail: 'Connected to Exchange Online.',
      runtime: null,
      userPrincipalName: 'admin@example.com',
      connectionId: 'conn-1',
      tenantId: 'tenant-configured',
      tokenStatus: 'Active',
      tokenExpiryTimeUtc: null,
      connectedAtUtc: null,
    });
    vi.mocked(getGraphGuestById).mockResolvedValue({
      stableKey: 'graph:objectId:guest-1',
      objectId: 'guest-1',
      displayName: 'Guest Example',
      primaryEmail: 'guest@example.com',
      userPrincipalName: 'guest_example.com#EXT#@tenant.onmicrosoft.com',
      companyName: null,
      externalUserState: 'Accepted',
    });

    await manager.connect();
    const result = await manager.getGuestById('guest-1');

    expect(result.objectId).toBe('guest-1');
  });
});
