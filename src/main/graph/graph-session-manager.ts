import type { AccountInfo, IPublicClientApplication } from '@azure/msal-node';

import { getExchangeConnectionStatus } from '@/main/exchange/get-exchange-connection-status';
import type { GraphConnectionStatus, TenantConfig } from '@/shared/contracts/graph';
import type {
  GuestsInvitePayload,
  GuestsInviteResult,
  GuestsSearchPayload,
  GuestsSearchResult,
} from '@/shared/contracts/guests';

import { loadTenantConfig } from '../config/tenant-config';
import {
  fetchGraphMe,
  fetchGraphOrganization,
  inviteGraphGuest,
  searchGraphGuests,
} from './graph-client';
import {
  acquireInteractiveGraphToken,
  acquireSilentGraphToken,
  createGraphPublicClient,
  signOutGraphAccount,
} from './msal-public-client';

type GraphSessionState = {
  config: TenantConfig;
  publicClient: IPublicClientApplication;
  account: AccountInfo;
  tokenExpiresOnUtc: string | null;
  tenantId: string;
  tenantDisplayName: string | null;
  accountDisplayName: string | null;
};

export class GraphSessionManager {
  private session: GraphSessionState | null = null;
  private operationQueue: Promise<void> = Promise.resolve();

  async connect(): Promise<GraphConnectionStatus> {
    return await this.runExclusive(async () => {
      try {
        const config = await loadTenantConfig();
        const publicClient = createGraphPublicClient(config);
        const authResult = await acquireInteractiveGraphToken(publicClient, config);
        const account = authResult.account;

        if (!account) {
          return createGraphErrorStatus(config, 'Microsoft Graph authentication completed without an account.');
        }

        const organization = await fetchGraphOrganization(authResult.accessToken);

        if (organization.id !== config.tenantId) {
          await signOutGraphAccount(publicClient, account);
          this.session = null;

          return createGraphErrorStatus(
            config,
            `Authenticated tenant ${organization.id} did not match configured tenant ${config.tenantId}.`,
          );
        }

        const me = await fetchGraphMe(authResult.accessToken);

        this.session = {
          config,
          publicClient,
          account,
          tokenExpiresOnUtc: authResult.expiresOn?.toISOString() ?? null,
          tenantId: organization.id,
          tenantDisplayName: organization.displayName,
          accountDisplayName: me.displayName,
        };

        const exchangeAlignment = await determineExchangeAlignment(this.session.tenantId);

        return {
          state: 'connected',
          detail: 'Connected to Microsoft Graph.',
          authMethod: 'interactiveBrowser',
          configuredTenantId: this.session.config.tenantId,
          tenantId: this.session.tenantId,
          tenantDisplayName: this.session.tenantDisplayName,
          accountUsername: this.session.account.username,
          accountDisplayName: this.session.accountDisplayName ?? this.session.account.name ?? null,
          tokenExpiresOnUtc: this.session.tokenExpiresOnUtc,
          exchangeAlignment,
        };
      } catch (error) {
        this.session = null;
        const config = await tryLoadTenantConfig();

        return createGraphErrorStatus(
          config,
          error instanceof Error ? error.message : 'Graph authentication failed.',
        );
      }
    });
  }

  async getConnectionStatus(): Promise<GraphConnectionStatus> {
    return await this.runExclusive(async () => {
      if (!this.session) {
        const config = await tryLoadTenantConfig();
        return createGraphDisconnectedStatus(config, 'Graph session is not connected.');
      }

      try {
        const authResult = await acquireSilentGraphToken(
          this.session.publicClient,
          this.session.config,
          this.session.account,
        );

        this.session.tokenExpiresOnUtc = authResult.expiresOn?.toISOString() ?? null;
        const exchangeAlignment = await determineExchangeAlignment(this.session.tenantId);

        return {
          state: 'connected',
          detail: 'Connected to Microsoft Graph.',
          authMethod: 'interactiveBrowser',
          configuredTenantId: this.session.config.tenantId,
          tenantId: this.session.tenantId,
          tenantDisplayName: this.session.tenantDisplayName,
          accountUsername: this.session.account.username,
          accountDisplayName: this.session.accountDisplayName ?? this.session.account.name ?? null,
          tokenExpiresOnUtc: this.session.tokenExpiresOnUtc,
          exchangeAlignment,
        };
      } catch (error) {
        const config = this.session.config;
        this.session = null;

        return createGraphErrorStatus(
          config,
          error instanceof Error ? error.message : 'Graph session is unavailable.',
        );
      }
    });
  }

  async disconnect(): Promise<GraphConnectionStatus> {
    return await this.runExclusive(async () => {
      if (!this.session) {
        const config = await tryLoadTenantConfig();
        return createGraphDisconnectedStatus(config, 'Graph session is not connected.');
      }

      const config = this.session.config;

      try {
        await signOutGraphAccount(this.session.publicClient, this.session.account);
      } finally {
        this.session = null;
      }

      return createGraphDisconnectedStatus(config, 'Disconnected from Microsoft Graph.');
    });
  }

  async searchGuests(payload: GuestsSearchPayload): Promise<GuestsSearchResult> {
    return await this.runExclusive(async () => {
      const { accessToken } = await this.acquireGraphToken();
      return await searchGraphGuests(accessToken, payload);
    });
  }

  async inviteGuest(payload: GuestsInvitePayload): Promise<GuestsInviteResult> {
    return await this.runExclusive(async () => {
      const { accessToken, config } = await this.acquireGraphToken();
      return await inviteGraphGuest(accessToken, payload, config.graph.inviteRedirectUrl);
    });
  }

  async shutdown(): Promise<void> {
    await this.runExclusive(async () => {
      if (!this.session) {
        return;
      }

      await signOutGraphAccount(this.session.publicClient, this.session.account);
      this.session = null;
    });
  }

  private async acquireGraphToken(): Promise<{ accessToken: string; config: TenantConfig }> {
    if (!this.session) {
      throw new Error('Graph session is not connected.');
    }

    const authResult = await acquireSilentGraphToken(
      this.session.publicClient,
      this.session.config,
      this.session.account,
    );

    this.session.tokenExpiresOnUtc = authResult.expiresOn?.toISOString() ?? null;

    return {
      accessToken: authResult.accessToken,
      config: this.session.config,
    };
  }

  private async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.operationQueue;
    let release: () => void = () => {};

    this.operationQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;

    try {
      return await operation();
    } finally {
      release();
    }
  }
}

export const graphSessionManager = new GraphSessionManager();

function createGraphDisconnectedStatus(
  config: TenantConfig | null,
  detail: string,
): GraphConnectionStatus {
  return {
    state: 'disconnected',
    detail,
    authMethod: null,
    configuredTenantId: config?.tenantId ?? null,
    tenantId: null,
    tenantDisplayName: null,
    accountUsername: null,
    accountDisplayName: null,
    tokenExpiresOnUtc: null,
    exchangeAlignment: 'unknown',
  };
}

function createGraphErrorStatus(
  config: TenantConfig | null,
  detail: string,
): GraphConnectionStatus {
  return {
    state: 'error',
    detail,
    authMethod: null,
    configuredTenantId: config?.tenantId ?? null,
    tenantId: null,
    tenantDisplayName: null,
    accountUsername: null,
    accountDisplayName: null,
    tokenExpiresOnUtc: null,
    exchangeAlignment: 'unknown',
  };
}

async function tryLoadTenantConfig(): Promise<TenantConfig | null> {
  try {
    return await loadTenantConfig();
  } catch {
    return null;
  }
}

async function determineExchangeAlignment(graphTenantId: string): Promise<'matched' | 'mismatched' | 'unknown'> {
  const exchangeStatus = await getExchangeConnectionStatus();

  if (exchangeStatus.state !== 'connected' || !exchangeStatus.tenantId) {
    return 'unknown';
  }

  return exchangeStatus.tenantId === graphTenantId ? 'matched' : 'mismatched';
}
