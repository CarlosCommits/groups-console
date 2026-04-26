import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type GraphConnectionError,
  type GraphRequestError,
  getGraphGuestById,
  getGraphGuestDetailsById,
  inviteGraphGuest,
  searchGraphGuests,
  updateGraphGuestCompany,
} from './graph-client';

describe('graph-client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('pages guest search results until enough matches are found', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          value: [
            {
              id: 'guest-1',
              displayName: 'Zed Example',
              userPrincipalName: 'zed_example.com#EXT#@tenant.onmicrosoft.com',
              mail: null,
              otherMails: ['zed@example.com'],
              companyName: null,
              externalUserState: 'Accepted',
            },
          ],
          '@odata.nextLink': 'https://graph.microsoft.com/v1.0/users?$skiptoken=next',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          value: [
            {
              id: 'guest-2',
              displayName: 'Jane Example',
              userPrincipalName: 'jane_example.com#EXT#@tenant.onmicrosoft.com',
              mail: null,
              otherMails: ['jane@example.com'],
              companyName: 'Example Corp',
              externalUserState: 'PendingAcceptance',
            },
          ],
        }),
      });

    global.fetch = fetchMock as typeof fetch;

    const result = await searchGraphGuests('token', { query: 'ja', limit: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.items[0]?.objectId).toBe('guest-2');
  });

  it('returns invitation success even when verification read is not yet available', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'invite-1',
          status: 'PendingAcceptance',
          inviteRedeemUrl: 'https://example.com/invite',
          invitedUser: {
            id: 'guest-1',
            displayName: 'Guest Example',
            userPrincipalName: 'guest_example.com#EXT#@tenant.onmicrosoft.com',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

    global.fetch = fetchMock as typeof fetch;

    const result = await inviteGraphGuest('token', { email: 'guest@example.com' }, 'https://example.com/complete');

    expect(result.outcome).toBe('invited');
    if (result.outcome !== 'invited') {
      throw new Error('Expected inviteGraphGuest to return an invited result.');
    }

    expect(result.invitationId).toBe('invite-1');
    expect(result.verification.foundGuest).toBe(false);
  });

  it('sends optional invitation message settings when Graph sends the email', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'invite-1',
          status: 'PendingAcceptance',
          inviteRedeemUrl: 'https://example.com/invite',
          invitedUser: {
            id: 'guest-1',
            displayName: 'Guest Example',
            userPrincipalName: 'guest_example.com#EXT#@tenant.onmicrosoft.com',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

    global.fetch = fetchMock as typeof fetch;

    await inviteGraphGuest(
      'token',
      {
        email: 'guest@example.com',
        displayName: 'Guest Example',
        sendInvitationMessage: true,
        invitationMessage: 'Welcome to the project.',
        invitationCcEmail: 'manager@example.com',
      },
      'https://example.com/complete',
    );

    const firstRequest = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const rawBody = firstRequest[1].body;
    if (typeof rawBody !== 'string') {
      throw new Error('Expected Graph invitation request body to be JSON.');
    }
    const requestBody = JSON.parse(rawBody) as {
      invitedUserMessageInfo?: {
        customizedMessageBody?: string;
        ccRecipients?: Array<{ emailAddress?: { address?: string } }>;
      };
    };

    expect(requestBody.invitedUserMessageInfo).toEqual({
      customizedMessageBody: 'Welcome to the project.',
      ccRecipients: [
        {
          emailAddress: {
            address: 'manager@example.com',
          },
        },
      ],
    });
  });

  it('keeps invite success when optional profile update fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'invite-1',
          status: 'PendingAcceptance',
          inviteRedeemUrl: 'https://example.com/invite',
          invitedUser: {
            id: 'guest-1',
            displayName: 'Guest Example',
            userPrincipalName: 'guest_example.com#EXT#@tenant.onmicrosoft.com',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'guest-1',
          displayName: 'Guest Example',
          userPrincipalName: 'guest_example.com#EXT#@tenant.onmicrosoft.com',
          mail: 'guest@example.com',
          otherMails: ['guest@example.com'],
          companyName: null,
          externalUserState: 'PendingAcceptance',
        }),
      });

    global.fetch = fetchMock as typeof fetch;

    const result = await inviteGraphGuest(
      'token',
      {
        email: 'guest@example.com',
        companyName: 'Guest Co',
        jobTitle: 'Consultant',
        department: 'Operations',
        officeLocation: 'HQ-201',
        mobilePhone: '+1 555-0100',
      },
      'https://example.com/complete',
    );

    expect(result.outcome).toBe('invited');
    if (result.outcome !== 'invited') {
      throw new Error('Expected inviteGraphGuest to return an invited result.');
    }

    expect(result.invitationId).toBe('invite-1');
    expect(result.companyUpdate.updated).toBe(false);
    expect(result.companyUpdate.detail).toContain('Microsoft Graph denied the profile update');
    expect(result.companyUpdate.detail).toContain('Microsoft Entra User Administrator');
    expect(result.companyUpdate.detail).toContain('User.ReadWrite.All');
  });

  it('updates requested guest profile fields after invitation creation', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'invite-1',
          status: 'PendingAcceptance',
          inviteRedeemUrl: 'https://example.com/invite',
          invitedUser: {
            id: 'guest-1',
            displayName: 'Guest Example',
            userPrincipalName: 'guest_example.com#EXT#@tenant.onmicrosoft.com',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'guest-1',
          companyName: 'Guest Co',
          jobTitle: 'Consultant',
          department: 'Operations',
          officeLocation: 'HQ-201',
          mobilePhone: '+1 555-0100',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'guest-1',
          displayName: 'Guest Example',
          userPrincipalName: 'guest_example.com#EXT#@tenant.onmicrosoft.com',
          mail: 'guest@example.com',
          otherMails: ['guest@example.com'],
          companyName: 'Guest Co',
          externalUserState: 'PendingAcceptance',
        }),
      });

    global.fetch = fetchMock as typeof fetch;

    const result = await inviteGraphGuest(
      'token',
      {
        email: 'guest@example.com',
        companyName: 'Guest Co',
        jobTitle: 'Consultant',
        department: 'Operations',
        officeLocation: 'HQ-201',
        mobilePhone: '+1 555-0100',
      },
      'https://example.com/complete',
    );

    const profileRequest = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    const rawBody = profileRequest[1].body;
    if (typeof rawBody !== 'string') {
      throw new Error('Expected Graph profile request body to be JSON.');
    }

    expect(JSON.parse(rawBody)).toEqual({
      companyName: 'Guest Co',
      jobTitle: 'Consultant',
      department: 'Operations',
      officeLocation: 'HQ-201',
      mobilePhone: '+1 555-0100',
    });
    expect(result.outcome).toBe('invited');
    if (result.outcome !== 'invited') {
      throw new Error('Expected inviteGraphGuest to return an invited result.');
    }
    expect(result.companyUpdate.updated).toBe(true);
  });

  it('updates guest company and verifies the new value', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'guest-1',
          companyName: 'Guest Co',
        }),
      });

    global.fetch = fetchMock as typeof fetch;

    const result = await updateGraphGuestCompany('token', {
      guestUserId: 'guest-1',
      companyName: 'Guest Co',
    });

    expect(result.verification.companyApplied).toBe(true);
  });

  it('treats empty successful Graph update responses as success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'guest-1',
          companyName: 'Guest Co',
        }),
      });

    global.fetch = fetchMock as typeof fetch;

    const result = await updateGraphGuestCompany('token', {
      guestUserId: 'guest-1',
      companyName: 'Guest Co',
    });

    expect(result.verification.companyApplied).toBe(true);
  });

  it('clears guest company when the requested value is blank', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'guest-1',
          companyName: null,
        }),
      });

    global.fetch = fetchMock as typeof fetch;

    const result = await updateGraphGuestCompany('token', {
      guestUserId: 'guest-1',
      companyName: '',
    });

    const patchInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(typeof patchInit?.body).toBe('string');
    expect(JSON.parse(patchInit?.body as string)).toEqual({ companyName: null });
    expect(result.companyName).toBeNull();
    expect(result.verification.companyApplied).toBe(true);
  });

  it('preserves Graph status and backend code on failed requests', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: () =>
        Promise.resolve({
          error: {
            code: 'Authorization_RequestDenied',
            message: 'Insufficient privileges to complete the operation.',
          },
        }),
    }) as typeof fetch;

    await expect(getGraphGuestById('token', 'guest-1')).rejects.toMatchObject({
      name: 'GraphRequestError',
      statusCode: 403,
      backendCode: 'Authorization_RequestDenied',
    } satisfies Partial<GraphRequestError>);
  });

  it('preserves transport failures as Graph connection errors', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed')) as typeof fetch;

    await expect(getGraphGuestById('token', 'guest-1')).rejects.toMatchObject({
      name: 'GraphConnectionError',
      backendCode: 'graph_transport_failure',
    } satisfies Partial<GraphConnectionError>);
  });

  it('reads a guest by object id', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'guest-1',
          displayName: 'Guest Example',
          userPrincipalName: 'guest_example.com#EXT#@tenant.onmicrosoft.com',
          mail: null,
          otherMails: ['guest@example.com'],
          companyName: null,
          externalUserState: 'Accepted',
          userType: 'Guest',
        }),
    });

    global.fetch = fetchMock as typeof fetch;

    const result = await getGraphGuestById('token', 'guest-1');

    expect(result.objectId).toBe('guest-1');
    expect(result.primaryEmail).toBe('guest@example.com');
  });

  it('rejects non-guest users in guest-by-id lookup', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'user-1',
          displayName: 'Member Example',
          userPrincipalName: 'member@example.com',
          mail: 'member@example.com',
          otherMails: ['member@example.com'],
          companyName: null,
          externalUserState: null,
          userType: 'Member',
        }),
    });

    global.fetch = fetchMock as typeof fetch;

    await expect(getGraphGuestById('token', 'user-1')).rejects.toThrow(
      "Graph object 'user-1' is not a guest user.",
    );
  });

  it('reads richer guest details by object id', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: '00000000-0000-0000-0000-000000000002',
          displayName: 'Guest Example',
          userPrincipalName: 'guest_example.com#EXT#@tenant.onmicrosoft.com',
          mail: null,
          otherMails: ['guest@example.com'],
          companyName: 'Guest Co',
          externalUserState: 'Accepted',
          userType: 'Guest',
          givenName: 'Guest',
          surname: 'Example',
          jobTitle: 'Consultant',
          department: 'Field',
          mobilePhone: '+1 555-0101',
          officeLocation: 'Remote',
          preferredLanguage: 'en-US',
          createdDateTime: '2026-04-14T12:00:00.000Z',
          accountEnabled: true,
        }),
    });

    global.fetch = fetchMock as typeof fetch;

    const result = await getGraphGuestDetailsById(
      'token',
      '00000000-0000-0000-0000-000000000002',
    );

    expect(result.guest.jobTitle).toBe('Consultant');
  });
});
