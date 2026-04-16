import type {
  RecipientSearchItem,
  RecipientSearchSourceFailure,
  RecipientSearchType,
  RecipientsSearchPayload,
  RecipientsSearchResult,
} from '@/shared/contracts/recipients';

import { searchExchangeRecipients } from '@/main/exchange/search-recipients';
import { getGraphConnectionStatus } from '@/main/graph/get-graph-connection-status';
import { searchGuestUsers } from '@/main/graph/search-guest-users';
import type { BackendOwner } from '@/main/logging';

import { classifyCommandError } from '@/main/ipc/classify-command-error';

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
          }).catch((error: unknown) => {
            throw withBackendOwner(error, 'exchange');
          });

    if (!wantsGuestUsers) {
      this.cacheRecipients(exchangeResult.items);
      return exchangeResult;
    }

    const graphStatus = await getGraphConnectionStatus();

    if (graphStatus.state !== 'connected') {
      const graphFailure = createGraphConnectionSourceFailure(graphStatus);
      const result = {
        ...exchangeResult,
        appliedTypes: this.withGuestType(exchangeResult, exchangeTypes),
        sourceStatus: {
          exchange: exchangeResult.sourceStatus.exchange,
          graph: 'unavailable' as const,
        },
        sourceFailures: {
          ...(exchangeResult.sourceFailures ?? {}),
          graph: graphFailure,
        },
      };

      this.cacheRecipients(result.items);
      return result;
    }

    if (graphStatus.exchangeAlignment === 'mismatched') {
      const graphFailure = createGraphTenantMismatchSourceFailure();
      const result = {
        ...exchangeResult,
        appliedTypes: this.withGuestType(exchangeResult, exchangeTypes),
        sourceStatus: {
          exchange: exchangeResult.sourceStatus.exchange,
          graph: 'deferred' as const,
        },
        sourceFailures: {
          ...(exchangeResult.sourceFailures ?? {}),
          graph: graphFailure,
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
        ...(exchangeResult.sourceFailures ? { sourceFailures: exchangeResult.sourceFailures } : {}),
        items: mergedItems.slice(0, exchangeResult.appliedLimit),
      };

      this.cacheRecipients(result.items);
      return result;
    } catch (error) {
      if (exchangeResult.items.length === 0 && exchangeResult.sourceStatus.exchange !== 'searched') {
        throw withBackendOwner(error, 'graph');
      }

      const result = {
        ...exchangeResult,
        appliedTypes: this.withGuestType(exchangeResult, exchangeTypes),
        sourceStatus: {
          exchange: exchangeResult.sourceStatus.exchange,
          graph: 'unavailable' as const,
        },
        sourceFailures: {
          ...(exchangeResult.sourceFailures ?? {}),
          graph: createGraphSourceFailure(error),
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

function withBackendOwner(
  error: unknown,
  backendOwner: BackendOwner,
): Error & { backendOwner: BackendOwner } {
  const baseError = error instanceof Error ? error : new Error('Recipient directory search failed.');
  return Object.assign(baseError, { backendOwner });
}

function createGraphConnectionSourceFailure(
  graphStatus: Awaited<ReturnType<typeof getGraphConnectionStatus>>,
): RecipientSearchSourceFailure {
  const classified: {
    message: string;
    details?: string;
    classification: RecipientSearchSourceFailure['classification'];
  } = graphStatus.failureClassification
    ? {
        message: graphStatus.detail,
        classification: graphStatus.failureClassification,
      }
    : classifyCommandError({
        commandName: 'recipients.search',
        backendOwner: 'graph',
        error: new Error(graphStatus.detail),
      });

  return {
    message: classified.message,
    ...(classified.details ? { details: classified.details } : {}),
    classification: classified.classification,
  };
}

function createGraphTenantMismatchSourceFailure(): RecipientSearchSourceFailure {
  return {
    message:
      'Microsoft Graph is connected, but the tenant does not match the current Exchange session.',
    classification: {
      category: 'tenantMismatch',
      remediation: 'reconnectMatchedTenant',
      backend: 'graph',
      operation: 'recipients.search',
      guidance:
        'Reconnect Microsoft Graph and Exchange with the same tenant, then retry the operation.',
    },
  };
}

function createGraphSourceFailure(error: unknown): RecipientSearchSourceFailure {
  const classified = classifyCommandError({
    commandName: 'recipients.search',
    backendOwner: 'graph',
    error: withBackendOwner(error, 'graph'),
  });

  return {
    message: classified.message,
    ...(classified.details ? { details: classified.details } : {}),
    classification: classified.classification,
  };
}

export const recipientDirectory: RecipientDirectoryProvider = new AppRecipientDirectory();
