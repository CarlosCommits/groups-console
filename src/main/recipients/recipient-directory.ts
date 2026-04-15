import type {
  RecipientSearchItem,
  RecipientSearchType,
  RecipientsSearchPayload,
  RecipientsSearchResult,
} from '@/shared/contracts/recipients';

import { searchExchangeRecipients } from '@/main/exchange/search-recipients';
import { getGraphConnectionStatus } from '@/main/graph/get-graph-connection-status';
import { searchGuestUsers } from '@/main/graph/search-guest-users';

export interface RecipientDirectoryProvider {
  searchRecipients(payload: RecipientsSearchPayload): Promise<RecipientsSearchResult>;
  getCachedRecipientByStableKey(stableKey: string): RecipientSearchItem | null;
}

class AppRecipientDirectory implements RecipientDirectoryProvider {
  private readonly detailCache = new Map<string, RecipientSearchItem>();

  private withGuestType(
    exchangeResult: RecipientsSearchResult,
    exchangeTypes: RecipientSearchType[] | undefined,
  ): RecipientSearchType[] {
    return exchangeTypes ? [...exchangeTypes, 'guestUser'] : [...exchangeResult.appliedTypes, 'guestUser'];
  }

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
      this.cacheRecipients(exchangeResult.items);
      return exchangeResult;
    }

    const graphStatus = await getGraphConnectionStatus();

    if (graphStatus.state !== 'connected') {
      const result = {
        ...exchangeResult,
        appliedTypes: this.withGuestType(exchangeResult, exchangeTypes),
        sourceStatus: {
          exchange: exchangeResult.sourceStatus.exchange,
          graph: 'unavailable' as const,
        },
      };

      this.cacheRecipients(result.items);
      return result;
    }

    if (graphStatus.exchangeAlignment === 'mismatched') {
      const result = {
        ...exchangeResult,
        appliedTypes: this.withGuestType(exchangeResult, exchangeTypes),
        sourceStatus: {
          exchange: exchangeResult.sourceStatus.exchange,
          graph: 'deferred' as const,
        },
      };

      this.cacheRecipients(result.items);
      return result;
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
          membershipSupport: 'graphBridgeable' as const,
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

      const result = {
        query: exchangeResult.query,
        appliedLimit: exchangeResult.appliedLimit,
        appliedTypes: this.withGuestType(exchangeResult, exchangeTypes),
        sourceStatus: {
          exchange: exchangeResult.sourceStatus.exchange,
          graph: 'searched' as const,
        },
        items: mergedItems.slice(0, exchangeResult.appliedLimit),
      };

      this.cacheRecipients(result.items);
      return result;
    } catch {
      const result = {
        ...exchangeResult,
        appliedTypes: this.withGuestType(exchangeResult, exchangeTypes),
        sourceStatus: {
          exchange: exchangeResult.sourceStatus.exchange,
          graph: 'unavailable' as const,
        },
      };

      this.cacheRecipients(result.items);
      return result;
    }
  }

  getCachedRecipientByStableKey(stableKey: string): RecipientSearchItem | null {
    return this.detailCache.get(stableKey) ?? null;
  }

  private cacheRecipients(items: RecipientSearchItem[]): void {
    this.detailCache.clear();
    items.forEach((item) => {
      this.detailCache.set(item.stableKey, item);
    });
  }
}

export const recipientDirectory: RecipientDirectoryProvider = new AppRecipientDirectory();
