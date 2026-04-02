import { describe, expect, it, vi } from 'vitest';

vi.mock('./exchange-session-manager', () => ({
  exchangeSessionManager: {
    listGroups: vi.fn(),
  },
}));

import { exchangeSessionManager } from './exchange-session-manager';

import { listExchangeGroups } from './list-exchange-groups';

describe('listExchangeGroups', () => {
  it('delegates to the exchange session manager', async () => {
    vi.mocked(exchangeSessionManager.listGroups).mockResolvedValue({
      appliedKind: 'all',
      items: [
        {
          objectId: null,
          exchangeIdentity: 'group-identity-1',
          displayName: 'All Staff',
          alias: 'allstaff',
          primaryEmail: 'allstaff@example.com',
          groupKind: 'distributionList',
          managedByDisplayNames: ['Owner One'],
          whenChangedUtc: '2026-04-01T12:00:00.000Z',
        },
      ],
    });

    const result = await listExchangeGroups({ kind: 'all' });

    expect(result.appliedKind).toBe('all');
    expect(exchangeSessionManager.listGroups).toHaveBeenCalledWith({ kind: 'all' });
  });
});
