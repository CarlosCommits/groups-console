import type { RecipientsSearchPayload, RecipientsSearchResult } from '@/shared/contracts/recipients';

import { searchExchangeRecipients } from '@/main/exchange/search-recipients';
import { getGraphConnectionStatus } from '@/main/graph/get-graph-connection-status';
import { searchGuestUsers } from '@/main/graph/search-guest-users';

export interface RecipientDirectoryProvider {
  searchRecipients(payload: RecipientsSearchPayload): Promise<RecipientsSearchResult>;
}

class AppRecipientDirectory implements RecipientDirectoryProvider {
  async searchRecipients(payload: RecipientsSearchPayload): Promise<RecipientsSearchResult> {
    const wantsGuestUsers = payload.types?.includes('guestUser') ?? false;
    const exchangeTypes = payload.types?.filter((type) => type !== 'guestUser');
    const exchangeResult =
      exchangeTypes && exchangeTypes.length === 0
        ? {
            query: payload.query.trim(),
            appliedLimit: payload.limit ?? 25,
            appliedTypes: [],
            sourceStatus: {
              exchange: 'skipped' as const,
              graph: 'skipped' as const,
            },
            items: [],
          }
        : await searchExchangeRecipients({
            ...payload,
            ...(exchangeTypes && exchangeTypes.length > 0 ? { types: exchangeTypes } : {}),
          });

    if (!wantsGuestUsers) {
      return exchangeResult;
    }

    const graphStatus = await getGraphConnectionStatus();

    if (graphStatus.state !== 'connected') {
      return {
        ...exchangeResult,
        appliedTypes: exchangeTypes ? [...exchangeTypes, 'guestUser'] : [...exchangeResult.appliedTypes, 'guestUser'],
        sourceStatus: {
          exchange: exchangeResult.sourceStatus.exchange,
          graph: 'unavailable',
        },
      };
    }

    if (graphStatus.exchangeAlignment === 'mismatched') {
      return {
        ...exchangeResult,
        appliedTypes: exchangeTypes ? [...exchangeTypes, 'guestUser'] : [...exchangeResult.appliedTypes, 'guestUser'],
        sourceStatus: {
          exchange: exchangeResult.sourceStatus.exchange,
          graph: 'deferred',
        },
      };
    }

    try {
      const guestResult = await searchGuestUsers({
        query: payload.query,
        limit: payload.limit,
      });
      const mergedItems = [
        ...exchangeResult.items,
        ...guestResult.items.map((guest) => ({
          source: 'graph' as const,
          stableKey: guest.stableKey,
          recipientType: 'guestUser' as const,
          membershipSupport: 'graphDeferred' as const,
          objectId: guest.objectId,
          exchangeIdentity: null,
          primaryEmail: guest.primaryEmail,
          displayName: guest.displayName ?? guest.primaryEmail ?? guest.userPrincipalName ?? guest.objectId,
          alias: null,
          recipientTypeDetails: guest.externalUserState,
          companyName: guest.companyName,
          companySource: guest.companyName ? ('graph' as const) : ('none' as const),
        })),
      ].sort((left, right) => left.displayName.localeCompare(right.displayName));

      return {
        query: exchangeResult.query,
        appliedLimit: exchangeResult.appliedLimit,
        appliedTypes: exchangeTypes ? [...exchangeTypes, 'guestUser'] : [...exchangeResult.appliedTypes, 'guestUser'],
        sourceStatus: {
          exchange: exchangeResult.sourceStatus.exchange,
          graph: 'searched',
        },
        items: mergedItems.slice(0, exchangeResult.appliedLimit),
      };
    } catch {
      return {
        ...exchangeResult,
        appliedTypes: exchangeTypes ? [...exchangeTypes, 'guestUser'] : [...exchangeResult.appliedTypes, 'guestUser'],
        sourceStatus: {
          exchange: exchangeResult.sourceStatus.exchange,
          graph: 'unavailable',
        },
      };
    }
  }
}

export const recipientDirectory: RecipientDirectoryProvider = new AppRecipientDirectory();
