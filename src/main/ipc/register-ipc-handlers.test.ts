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
  readSystemLogEvents: vi.fn(),
  runWithOperationContext: vi.fn(async (_context, callback: () => Promise<unknown>) => await callback()),
  writeSystemLogEvent: vi.fn(),
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

vi.mock('@/main/exchange/get-recipient-details', () => ({
  getExchangeRecipientDetails: vi.fn(),
}));

vi.mock('@/main/graph/invite-guest-user', () => ({
  inviteGuestUser: vi.fn(),
}));

vi.mock('@/main/recipients/recipient-directory', () => ({
  recipientDirectory: {
    getCachedRecipientByStableKey: vi.fn(),
    searchRecipients: vi.fn(),
  },
}));

import { readSystemLogEvents, writeOperationalLog, writeSystemLogEvent } from '@/main/logging';
import { createContact } from '@/main/exchange/create-contact';
import { getExchangeRecipientDetails } from '@/main/exchange/get-recipient-details';
import { getExchangeConnectionStatus } from '@/main/exchange/get-exchange-connection-status';
import { getGraphConnectionStatus } from '@/main/graph/get-graph-connection-status';
import { inviteGuestUser } from '@/main/graph/invite-guest-user';
import { getSessionStatus } from '@/main/ipc/handlers/get-session-status';
import { recipientDirectory } from '@/main/recipients/recipient-directory';

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

  it('returns system logs through the system log route', async () => {
    vi.mocked(readSystemLogEvents).mockResolvedValue({
      items: [
        {
          timestamp: '2026-04-17T12:00:00.000Z',
          operationId: 'op-1',
          ipcRequestId: 'req-1',
          actorUpn: 'admin@example.com',
          tenantId: 'tenant-1',
          operationType: 'groups.addMembers',
          targetObjectType: 'distributionList',
          targetObjectId: 'group-1',
          summary: 'Attempted to add 2 members.',
          result: 'succeeded',
          authoritative: true,
        },
      ],
      nextCursor: null,
    });

    registerIpcHandlers();
    const handler = handleMock.mock.calls[0]?.[1];

    const response = await handler(
      { sender: { send: vi.fn() } },
      {
        requestId: 'req-audit',
        command: 'systemLogs.listEvents',
        issuedAt: new Date().toISOString(),
        payload: {
          scope: { kind: 'all' },
        },
      },
    );

    expect(readSystemLogEvents).toHaveBeenCalledWith({
      scope: { kind: 'all' },
    });
    expect(response).toMatchObject({
      success: true,
      data: {
        items: [
          {
            operationId: 'op-1',
            result: 'succeeded',
          },
        ],
        nextCursor: null,
      },
    });
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
    expect(writeSystemLogEvent).toHaveBeenCalledWith(
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

    expect(writeSystemLogEvent).toHaveBeenCalledWith(
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

    expect(writeSystemLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'partial',
        authoritative: false,
      }),
    );
  });

  it('classifies graph 403 failures instead of returning command_failed', async () => {
    vi.mocked(inviteGuestUser).mockRejectedValue(
      Object.assign(new Error('Microsoft Graph request failed with 403 Forbidden.'), {
        statusCode: 403,
        backendCode: 'Authorization_RequestDenied',
      }),
    );

    registerIpcHandlers();
    const handler = handleMock.mock.calls[0]?.[1];

    const response = await handler(
      { sender: { send: vi.fn() } },
      {
        requestId: 'req-5',
        command: 'guests.invite',
        issuedAt: new Date().toISOString(),
        payload: {
          email: 'guest@example.com',
        },
      },
    );

    expect(response).toMatchObject({
      success: false,
      error: {
        code: 'graph_authorization_failure',
        classification: {
          category: 'authorizationFailure',
          backendCode: 'Authorization_RequestDenied',
        },
      },
    });
    expect(writeOperationalLog).toHaveBeenCalledWith(
      expect.objectContaining({
        safeErrorCode: 'graph_authorization_failure',
      }),
    );
  });

  it('classifies exchange disconnect requirements as connection failures', async () => {
    vi.mocked(createContact).mockRejectedValue(
      new Error('Exchange session host is not running. Connect to Exchange Online first.'),
    );

    registerIpcHandlers();
    const handler = handleMock.mock.calls[0]?.[1];

    const response = await handler(
      { sender: { send: vi.fn() } },
      {
        requestId: 'req-6',
        command: 'contacts.create',
        issuedAt: new Date().toISOString(),
        payload: {
          firstName: 'Jane',
          lastName: 'Example',
          email: 'jane@example.com',
          companyName: 'Example Corp',
        },
      },
    );

    expect(response).toMatchObject({
      success: false,
      error: {
        code: 'exchange_connection_failure',
        retryable: true,
        classification: {
          category: 'connectionFailure',
        },
      },
    });
  });

  it('logs classified backend owners for composite search failures', async () => {
    vi.mocked(recipientDirectory.searchRecipients).mockRejectedValue(
      Object.assign(new Error('Exchange session host is not running. Connect to Exchange Online first.'), {
        backendOwner: 'exchange',
      }),
    );

    registerIpcHandlers();
    const handler = handleMock.mock.calls[0]?.[1];

    const response = await handler(
      { sender: { send: vi.fn() } },
      {
        requestId: 'req-7',
        command: 'recipients.search',
        issuedAt: new Date().toISOString(),
        payload: {
          query: 'ja',
          types: ['mailbox', 'guestUser'],
        },
      },
    );

    expect(response).toMatchObject({
      success: false,
      error: {
        classification: {
          backend: 'exchange',
        },
      },
    });
    expect(writeOperationalLog).toHaveBeenCalledWith(
      expect.objectContaining({
        backendOwner: 'exchange',
      }),
    );
  });

  it('reads mailbox details through the exchange recipient detail route', async () => {
    vi.mocked(recipientDirectory.getCachedRecipientByStableKey).mockReturnValue({
      source: 'exchange',
      stableKey: 'exchange:objectId:recipient-1',
      recipientType: 'mailbox',
      membershipSupport: 'exchangeDirect',
      objectId: 'recipient-1',
      exchangeIdentity: 'jane@example.com',
      primaryEmail: 'jane@example.com',
      displayName: 'Jane Example',
      alias: 'jexample',
      recipientTypeDetails: 'UserMailbox',
      companyName: 'Example Corp',
      companySource: 'exchange',
    });
    vi.mocked(getExchangeRecipientDetails).mockResolvedValue({
      recipient: {
        exchangeIdentity: 'jane@example.com',
        objectId: 'recipient-1',
        primaryEmail: 'jane@example.com',
        externalEmailAddress: null,
        displayName: 'Jane Example',
        alias: 'jexample',
        companyName: 'Example Corp',
        firstName: 'Jane',
        lastName: 'Example',
        title: 'Director',
        department: 'Operations',
        phone: '+1 555-0100',
        office: 'HQ-201',
        userPrincipalName: 'jane@example.com',
        recipientType: 'mailbox',
        recipientTypeDetails: 'UserMailbox',
      },
    });

    registerIpcHandlers();
    const handler = handleMock.mock.calls[0]?.[1];

    const response = await handler(
      { sender: { send: vi.fn() } },
      {
        requestId: 'req-8',
        command: 'exchange.getRecipientDetails',
        issuedAt: new Date().toISOString(),
        payload: {
          stableKey: 'exchange:objectId:recipient-1',
        },
      },
    );

    expect(response).toMatchObject({
      success: true,
      data: {
        recipient: {
          recipientType: 'mailbox',
          externalEmailAddress: null,
        },
      },
    });
  });

  it('returns distinct org and external email details for cached mail users', async () => {
    vi.mocked(recipientDirectory.getCachedRecipientByStableKey).mockReturnValue({
      source: 'exchange',
      stableKey: 'exchange:objectId:recipient-2',
      recipientType: 'mailUser',
      membershipSupport: 'exchangeDirect',
      objectId: 'recipient-2',
      exchangeIdentity: 'jane.external@example.com',
      primaryEmail: 'jane@yourcompany.com',
      displayName: 'Jane External',
      alias: 'jexternal',
      recipientTypeDetails: 'MailUser',
      companyName: 'Example Corp',
      companySource: 'exchange',
    });
    vi.mocked(getExchangeRecipientDetails).mockResolvedValue({
      recipient: {
        exchangeIdentity: 'jane.external@example.com',
        objectId: 'recipient-2',
        primaryEmail: 'jane@yourcompany.com',
        externalEmailAddress: 'jane@gmail.com',
        displayName: 'Jane External',
        alias: 'jexternal',
        companyName: 'Example Corp',
        firstName: 'Jane',
        lastName: 'External',
        title: 'Director',
        department: 'Operations',
        phone: '+1 555-0100',
        office: 'HQ-201',
        userPrincipalName: 'jane_external#EXT#@tenant.onmicrosoft.com',
        recipientType: 'mailUser',
        recipientTypeDetails: 'MailUser',
      },
    });

    registerIpcHandlers();
    const handler = handleMock.mock.calls[0]?.[1];

    const response = await handler(
      { sender: { send: vi.fn() } },
      {
        requestId: 'req-10',
        command: 'exchange.getRecipientDetails',
        issuedAt: new Date().toISOString(),
        payload: {
          stableKey: 'exchange:objectId:recipient-2',
        },
      },
    );

    expect(response).toMatchObject({
      success: true,
      data: {
        recipient: {
          recipientType: 'mailUser',
          primaryEmail: 'jane@yourcompany.com',
          externalEmailAddress: 'jane@gmail.com',
        },
      },
    });
  });

  it('rejects exchange recipient detail requests for unsupported cached recipient types', async () => {
    vi.mocked(recipientDirectory.getCachedRecipientByStableKey).mockReturnValue({
      source: 'exchange',
      stableKey: 'exchange:objectId:contact-1',
      recipientType: 'mailContact',
      membershipSupport: 'exchangeDirect',
      objectId: 'contact-1',
      exchangeIdentity: 'contact@example.com',
      primaryEmail: 'contact@example.com',
      displayName: 'Contact Example',
      alias: 'cexample',
      recipientTypeDetails: 'MailContact',
      companyName: 'Example Corp',
      companySource: 'exchange',
    });

    registerIpcHandlers();
    const handler = handleMock.mock.calls[0]?.[1];

    const response = await handler(
      { sender: { send: vi.fn() } },
      {
        requestId: 'req-9',
        command: 'exchange.getRecipientDetails',
        issuedAt: new Date().toISOString(),
        payload: {
          stableKey: 'exchange:objectId:contact-1',
        },
      },
    );

    expect(response).toMatchObject({
      success: false,
      error: {
        classification: {
          backend: 'exchange',
        },
      },
    });
    expect(getExchangeRecipientDetails).not.toHaveBeenCalled();
  });
});
