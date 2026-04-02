import { describe, expect, it, vi } from 'vitest';

vi.mock('./graph-session-manager', () => ({
  graphSessionManager: {
    searchGuests: vi.fn(),
  },
}));

import { graphSessionManager } from './graph-session-manager';

import { searchGuestUsers } from './search-guest-users';

describe('searchGuestUsers', () => {
  it('delegates to the graph session manager', async () => {
    vi.mocked(graphSessionManager.searchGuests).mockResolvedValue({
      query: 'ja',
      appliedLimit: 25,
      items: [],
    });

    const result = await searchGuestUsers({ query: 'ja', limit: 25 });

    expect(result.query).toBe('ja');
  });
});
