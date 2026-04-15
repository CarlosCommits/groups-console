import { describe, expect, it, vi } from 'vitest';

vi.mock('./graph-session-manager', () => ({
  graphSessionManager: {
    getGuestDetails: vi.fn(),
  },
}));

import { graphSessionManager } from './graph-session-manager';
import { getGuestDetails } from './get-guest-details';

describe('getGuestDetails', () => {
  it('delegates to the graph session manager', async () => {
    vi.mocked(graphSessionManager.getGuestDetails).mockResolvedValue({
      guest: {
        stableKey: 'graph:objectId:00000000-0000-0000-0000-000000000002',
        objectId: '00000000-0000-0000-0000-000000000002',
        displayName: 'Guest Example',
        primaryEmail: 'guest@example.com',
        userPrincipalName: 'guest_example.com#EXT#@tenant.onmicrosoft.com',
        companyName: 'Guest Co',
        externalUserState: 'Accepted',
        givenName: 'Guest',
        surname: 'Example',
        jobTitle: 'Consultant',
        department: 'Field',
        mobilePhone: '+1 555-0101',
        officeLocation: 'Remote',
        preferredLanguage: 'en-US',
        createdDateTime: '2026-04-14T12:00:00.000Z',
        accountEnabled: true,
      },
    });

    const result = await getGuestDetails('00000000-0000-0000-0000-000000000002');

    expect(result.guest.objectId).toBe('00000000-0000-0000-0000-000000000002');
  });
});
