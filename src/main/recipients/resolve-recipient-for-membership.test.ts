import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/main/exchange/get-exchange-connection-status', () => ({
  getExchangeConnectionStatus: vi.fn(),
}));

vi.mock('@/main/exchange/exchange-session-manager', () => ({
  exchangeSessionManager: {
    resolveGuestMailUserByObjectId: vi.fn(),
  },
}));

vi.mock('@/main/graph/get-graph-connection-status', () => ({
  getGraphConnectionStatus: vi.fn(),
}));

vi.mock('@/main/graph/graph-session-manager', () => ({
  graphSessionManager: {
    getGuestById: vi.fn(),
  },
}));

import { getExchangeConnectionStatus } from '@/main/exchange/get-exchange-connection-status';
import { exchangeSessionManager } from '@/main/exchange/exchange-session-manager';
import { getGraphConnectionStatus } from '@/main/graph/get-graph-connection-status';
import { graphSessionManager } from '@/main/graph/graph-session-manager';

import { resolveRecipientForMembership } from './resolve-recipient-for-membership';

describe('resolveRecipientForMembership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps exchange recipient selections directly into membership refs', async () => {
    const result = await resolveRecipientForMembership({
      kind: 'exchangeRecipient',
      exchangeIdentity: 'jane@example.com',
      objectId: 'recipient-1',
      primaryEmail: 'jane@example.com',
      displayName: 'Jane Example',
    });

    expect(result.kind).toBe('exchangeDirect');
    if (result.kind === 'exchangeDirect') {
      expect(result.member.exchangeIdentity).toBe('jane@example.com');
    }
    expect(getExchangeConnectionStatus).not.toHaveBeenCalled();
  });

  it('resolves Graph guest selections into Exchange GuestMailUser membership refs', async () => {
    vi.mocked(getExchangeConnectionStatus).mockResolvedValue({
      state: 'connected',
      detail: 'Connected',
      runtime: null,
      userPrincipalName: 'admin@example.com',
      connectionId: 'ex-1',
      tenantId: 'tenant-1',
      tokenStatus: 'Active',
      tokenExpiryTimeUtc: null,
      connectedAtUtc: null,
    });
    vi.mocked(getGraphConnectionStatus).mockResolvedValue({
      state: 'connected',
      detail: 'Connected',
      authMethod: 'interactiveBrowser',
      configuredTenantId: 'tenant-1',
      tenantId: 'tenant-1',
      tenantDisplayName: 'Example Tenant',
      accountUsername: 'admin@example.com',
      accountDisplayName: 'Admin Example',
      tokenExpiresOnUtc: null,
      exchangeAlignment: 'matched',
    });
    vi.mocked(graphSessionManager.getGuestById).mockResolvedValue({
      stableKey: 'graph:objectId:guest-1',
      objectId: 'guest-1',
      displayName: 'Guest Example',
      primaryEmail: 'guest@example.com',
      userPrincipalName: 'guest_example.com#EXT#@tenant.onmicrosoft.com',
      companyName: null,
      externalUserState: 'Accepted',
    });
    vi.mocked(exchangeSessionManager.resolveGuestMailUserByObjectId).mockResolvedValue({
      resolved: true,
      member: {
        exchangeIdentity: 'Guest_abc123',
        objectId: 'guest-1',
        primaryEmail: 'guest@example.com',
      },
      detail: 'Resolved the selected guest to an Exchange GuestMailUser.',
    });

    const result = await resolveRecipientForMembership({
      kind: 'graphGuest',
      objectId: 'guest-1',
      primaryEmail: 'guest@example.com',
      displayName: 'Guest Example',
    });

    expect(result.kind).toBe('exchangeDirect');
    if (result.kind === 'exchangeDirect') {
      expect(result.member.exchangeIdentity).toBe('Guest_abc123');
    }
  });

  it('keeps Graph guests deferred when Exchange visibility is not yet available', async () => {
    vi.mocked(getExchangeConnectionStatus).mockResolvedValue({
      state: 'connected',
      detail: 'Connected',
      runtime: null,
      userPrincipalName: 'admin@example.com',
      connectionId: 'ex-1',
      tenantId: 'tenant-1',
      tokenStatus: 'Active',
      tokenExpiryTimeUtc: null,
      connectedAtUtc: null,
    });
    vi.mocked(getGraphConnectionStatus).mockResolvedValue({
      state: 'connected',
      detail: 'Connected',
      authMethod: 'interactiveBrowser',
      configuredTenantId: 'tenant-1',
      tenantId: 'tenant-1',
      tenantDisplayName: 'Example Tenant',
      accountUsername: 'admin@example.com',
      accountDisplayName: 'Admin Example',
      tokenExpiresOnUtc: null,
      exchangeAlignment: 'matched',
    });
    vi.mocked(graphSessionManager.getGuestById).mockResolvedValue({
      stableKey: 'graph:objectId:guest-1',
      objectId: 'guest-1',
      displayName: 'Guest Example',
      primaryEmail: 'guest@example.com',
      userPrincipalName: 'guest_example.com#EXT#@tenant.onmicrosoft.com',
      companyName: null,
      externalUserState: 'Accepted',
    });
    vi.mocked(exchangeSessionManager.resolveGuestMailUserByObjectId).mockResolvedValue({
      resolved: false,
      member: null,
      detail: 'The selected guest is not yet visible in Exchange as a GuestMailUser.',
    });

    const result = await resolveRecipientForMembership({
      kind: 'graphGuest',
      objectId: 'guest-1',
      primaryEmail: 'guest@example.com',
      displayName: 'Guest Example',
    });

    expect(result).toEqual({
      kind: 'graphDeferred',
      reason: 'The selected guest is not yet visible in Exchange as a GuestMailUser.',
    });
  });
});
