import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/main/exchange/get-exchange-connection-status', () => ({
  getExchangeConnectionStatus: vi.fn(),
}));

vi.mock('@/main/exchange/exchange-session-manager', () => ({
  exchangeSessionManager: {
    lookupRecipientOwnershipByEmail: vi.fn(),
  },
}));

vi.mock('@/main/graph/get-graph-connection-status', () => ({
  getGraphConnectionStatus: vi.fn(),
}));

vi.mock('@/main/graph/graph-session-manager', () => ({
  graphSessionManager: {
    findGuestByEmail: vi.fn(),
  },
}));

import { getExchangeConnectionStatus } from '@/main/exchange/get-exchange-connection-status';
import { exchangeSessionManager } from '@/main/exchange/exchange-session-manager';
import { getGraphConnectionStatus } from '@/main/graph/get-graph-connection-status';
import { graphSessionManager } from '@/main/graph/graph-session-manager';

import { checkRecipientConflicts } from './recipient-conflict-service';

describe('checkRecipientConflicts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when the target email is clear in both systems', async () => {
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
    vi.mocked(exchangeSessionManager.lookupRecipientOwnershipByEmail).mockResolvedValue([]);
    vi.mocked(graphSessionManager.findGuestByEmail).mockResolvedValue(null);

    await expect(checkRecipientConflicts('contacts.create', 'jane@example.com')).resolves.toBeNull();
  });

  it('blocks contact creation when an Exchange recipient already owns the email', async () => {
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
    vi.mocked(exchangeSessionManager.lookupRecipientOwnershipByEmail).mockResolvedValue([
      {
        source: 'exchange',
        recipientType: 'mailbox',
        objectId: 'user-1',
        exchangeIdentity: 'jane@example.com',
        userPrincipalName: null,
        displayName: 'Jane Example',
        primaryEmail: 'jane@example.com',
        alternateEmails: ['jane@example.com'],
      },
    ]);
    vi.mocked(graphSessionManager.findGuestByEmail).mockResolvedValue(null);

    const result = await checkRecipientConflicts('contacts.create', 'jane@example.com');

    expect(result?.category).toBe('emailAlreadyOwned');
  });

  it('blocks guest invitation when an Exchange recipient would create overlap', async () => {
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
    vi.mocked(exchangeSessionManager.lookupRecipientOwnershipByEmail).mockResolvedValue([
      {
        source: 'exchange',
        recipientType: 'mailContact',
        objectId: 'contact-1',
        exchangeIdentity: 'guest@example.com',
        userPrincipalName: null,
        displayName: 'Guest Example',
        primaryEmail: 'guest@example.com',
        alternateEmails: ['guest@example.com'],
      },
    ]);
    vi.mocked(graphSessionManager.findGuestByEmail).mockResolvedValue(null);

    const result = await checkRecipientConflicts('guests.invite', 'guest@example.com');

    expect(result?.category).toBe('guestContactOverlap');
  });

  it('blocks contact creation when Graph is unavailable for overlap validation', async () => {
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
      state: 'disconnected',
      detail: 'Disconnected',
      authMethod: null,
      configuredTenantId: 'tenant-1',
      tenantId: null,
      tenantDisplayName: null,
      accountUsername: null,
      accountDisplayName: null,
      tokenExpiresOnUtc: null,
      exchangeAlignment: 'unknown',
    });

    const result = await checkRecipientConflicts('contacts.create', 'jane@example.com');

    expect(result?.category).toBe('preflightUnavailable');
    expect(exchangeSessionManager.lookupRecipientOwnershipByEmail).not.toHaveBeenCalled();
  });

  it('blocks contact creation when Exchange is unavailable for overlap validation', async () => {
    vi.mocked(getExchangeConnectionStatus).mockResolvedValue({
      state: 'disconnected',
      detail: 'Disconnected',
      runtime: null,
      userPrincipalName: null,
      connectionId: null,
      tenantId: null,
      tokenStatus: null,
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
      exchangeAlignment: 'unknown',
    });

    const result = await checkRecipientConflicts('contacts.create', 'jane@example.com');

    expect(result?.category).toBe('preflightUnavailable');
    expect(result?.message).toContain('Exchange Online is connected');
    expect(exchangeSessionManager.lookupRecipientOwnershipByEmail).not.toHaveBeenCalled();
    expect(graphSessionManager.findGuestByEmail).not.toHaveBeenCalled();
  });

  it('returns preflightUnavailable when lookup execution fails after status checks pass', async () => {
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
    vi.mocked(exchangeSessionManager.lookupRecipientOwnershipByEmail).mockRejectedValue(
      new Error('Exchange lookup failed.'),
    );
    vi.mocked(graphSessionManager.findGuestByEmail).mockResolvedValue(null);

    const result = await checkRecipientConflicts('contacts.create', 'jane@example.com');

    expect(result?.category).toBe('preflightUnavailable');
    expect(result?.message).toContain('preflight could not complete');
  });
});
