import { describe, expect, it, vi } from 'vitest';

vi.mock('./graph-session-manager', () => ({
  graphSessionManager: {
    updateGuestCompany: vi.fn(),
  },
}));

import { graphSessionManager } from './graph-session-manager';

import { updateGuestCompany } from './update-guest-company';

describe('updateGuestCompany', () => {
  it('delegates to the graph session manager', async () => {
    vi.mocked(graphSessionManager.updateGuestCompany).mockResolvedValue({
      guestUserId: 'guest-1',
      companyName: 'Guest Co',
      verification: {
        attempted: true,
        foundGuest: true,
        companyApplied: true,
        detail: 'Verified guest company update.',
      },
    });

    const result = await updateGuestCompany({
      guestUserId: 'guest-1',
      companyName: 'Guest Co',
    });

    expect(result.companyName).toBe('Guest Co');
  });
});
