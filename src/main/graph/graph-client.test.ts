import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { inviteGraphGuest, searchGraphGuests } from './graph-client';

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

    expect(result.invitationId).toBe('invite-1');
    expect(result.verification.foundGuest).toBe(false);
  });
});
