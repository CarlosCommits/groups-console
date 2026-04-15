import { beforeEach, describe, expect, it, vi } from 'vitest';

const { handleMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
}));

vi.mock('electron', () => ({
  BrowserWindow: {
    fromWebContents: vi.fn(() => null),
  },
  ipcMain: {
    handle: handleMock,
  },
}));

vi.mock('@/main/logging', () => ({
  runWithOperationContext: vi.fn(async (_context, callback: () => Promise<unknown>) => await callback()),
  writeAuditEvent: vi.fn(),
  writeOperationalLog: vi.fn(),
}));

vi.mock('@/main/graph/get-graph-connection-status', () => ({
  getGraphConnectionStatus: vi.fn().mockResolvedValue({
    state: 'disconnected',
    detail: 'Disconnected',
    authMethod: null,
    configuredTenantId: null,
    tenantId: null,
    tenantDisplayName: null,
    accountUsername: null,
    accountDisplayName: null,
    tokenExpiresOnUtc: null,
    exchangeAlignment: 'unknown',
  }),
}));

vi.mock('@/main/exchange/get-exchange-connection-status', () => ({
  getExchangeConnectionStatus: vi.fn().mockResolvedValue({
    state: 'disconnected',
    detail: 'Disconnected',
    runtime: null,
    userPrincipalName: null,
    connectionId: null,
    tenantId: null,
    tokenStatus: null,
    tokenExpiryTimeUtc: null,
    connectedAtUtc: null,
  }),
}));

vi.mock('@/main/ipc/validate-event-sender', () => ({
  validateEventSender: vi.fn(() => true),
}));

vi.mock('@/main/ipc/handlers/get-session-status', () => ({
  getSessionStatus: vi.fn(),
}));

vi.mock('@/main/exchange/create-contact', () => ({
  createContact: vi.fn(),
}));

vi.mock('@/main/graph/invite-guest-user', () => ({
  inviteGuestUser: vi.fn(),
}));

import { writeAuditEvent, writeOperationalLog } from '@/main/logging';
import { createContact } from '@/main/exchange/create-contact';
import { getExchangeConnectionStatus } from '@/main/exchange/get-exchange-connection-status';
import { getGraphConnectionStatus } from '@/main/graph/get-graph-connection-status';
import { inviteGuestUser } from '@/main/graph/invite-guest-user';
import { getSessionStatus } from '@/main/ipc/handlers/get-session-status';

import { registerIpcHandlers } from './register-ipc-handlers';

describe('registerIpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handleMock.mockReset();
  });

  it('keeps a single operationId for started and failed logs', async () => {
    vi.mocked(getSessionStatus).mockRejectedValue(new Error('Session failure.'));

    registerIpcHandlers();
    const handler = handleMock.mock.calls[0]?.[1];

    const response = (await handler(
      { sender: {} },
      {
        requestId: 'req-1',
        command: 'session.getStatus',
        issuedAt: new Date().toISOString(),
        payload: {},
      },
    )) as { success: boolean };

    expect(response.success).toBe(false);
    const operationIds = vi.mocked(writeOperationalLog).mock.calls.map((call) => call[0].operationId);
    expect(new Set(operationIds).size).toBe(1);
  });

  it('does not fail a successful command when operational logging throws', async () => {
    vi.mocked(getSessionStatus).mockResolvedValue({
      appVersion: '0.1.0-test',
      environment: 'development',
      checks: [],
      security: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    vi.mocked(writeOperationalLog).mockRejectedValue(new Error('disk unavailable'));

    registerIpcHandlers();
    const handler = handleMock.mock.calls[0]?.[1];

    const response = (await handler(
      { sender: {} },
      {
        requestId: 'req-1',
        command: 'session.getStatus',
        issuedAt: new Date().toISOString(),
        payload: {},
      },
    )) as { success: boolean };

    expect(response.success).toBe(true);
  });

  it('audits blocked contact creation as non-authoritative failure', async () => {
    vi.mocked(createContact).mockResolvedValue({
      outcome: 'blockedConflict',
      conflict: {
        action: 'contacts.create',
        category: 'guestContactOverlap',
        blocking: true,
        targetEmail: 'jane@example.com',
        message: 'A guest already exists.',
        guidance: 'Use the existing guest.',
        records: [],
      },
    });

    registerIpcHandlers();
    const handler = handleMock.mock.calls[0]?.[1];

    const response = (await handler(
      { sender: { send: vi.fn() } },
      {
        requestId: 'req-2',
        command: 'contacts.create',
        issuedAt: new Date().toISOString(),
        payload: {
          firstName: 'Jane',
          lastName: 'Example',
          email: 'jane@example.com',
          companyName: 'Example Corp',
        },
      },
    )) as { success: boolean };

    expect(response.success).toBe(true);
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'failed',
        authoritative: false,
      }),
    );
  });

  it('attributes guest mutations to Graph identity when both backends are connected', async () => {
    vi.mocked(getExchangeConnectionStatus).mockResolvedValue({
      state: 'connected',
      detail: 'Connected',
      runtime: null,
      userPrincipalName: 'exchange-admin@example.com',
      connectionId: 'conn-1',
      tenantId: 'exchange-tenant',
      tokenStatus: 'Active',
      tokenExpiryTimeUtc: null,
      connectedAtUtc: null,
    });
    vi.mocked(getGraphConnectionStatus).mockResolvedValue({
      state: 'connected',
      detail: 'Connected',
      authMethod: 'interactiveBrowser',
      configuredTenantId: 'graph-tenant',
      tenantId: 'graph-tenant',
      tenantDisplayName: 'Graph Tenant',
      accountUsername: 'graph-admin@example.com',
      accountDisplayName: 'Graph Admin',
      tokenExpiresOnUtc: null,
      exchangeAlignment: 'matched',
    });

    vi.mocked(inviteGuestUser).mockResolvedValue({
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
        detail: 'No company update requested.',
      },
      verification: {
        attempted: true,
        foundGuest: true,
        detail: 'Verified invited guest in Microsoft Graph.',
      },
    });

    registerIpcHandlers();
    const handler = handleMock.mock.calls[0]?.[1];

    await handler(
      { sender: { send: vi.fn() } },
      {
        requestId: 'req-3',
        command: 'guests.invite',
        issuedAt: new Date().toISOString(),
        payload: {
          email: 'guest@example.com',
        },
      },
    );

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUpn: 'graph-admin@example.com',
        tenantId: 'graph-tenant',
      }),
    );
  });

  it('downgrades guest invite audits when verification does not find the guest', async () => {
    vi.mocked(inviteGuestUser).mockResolvedValue({
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
        detail: 'No company update requested.',
      },
      verification: {
        attempted: true,
        foundGuest: false,
        detail: 'Guest could not be re-read after invitation.',
      },
    });

    registerIpcHandlers();
    const handler = handleMock.mock.calls[0]?.[1];

    await handler(
      { sender: { send: vi.fn() } },
      {
        requestId: 'req-4',
        command: 'guests.invite',
        issuedAt: new Date().toISOString(),
        payload: {
          email: 'guest@example.com',
        },
      },
    );

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'partial',
        authoritative: false,
      }),
    );
  });
});
