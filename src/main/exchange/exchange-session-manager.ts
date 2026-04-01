import {
  exchangeConnectionStatusSchema,
  type ExchangeConnectPayload,
  type ExchangeConnectionStatus,
} from '@/shared/contracts/exchange';

import { startExchangeSessionHost, type ExchangeSessionHost } from '@/main/powershell/start-exchange-session-host';

function createDisconnectedStatus(detail: string): ExchangeConnectionStatus {
  return exchangeConnectionStatusSchema.parse({
    state: 'disconnected',
    detail,
    runtime: null,
    userPrincipalName: null,
    connectionId: null,
    tenantId: null,
    tokenStatus: null,
    tokenExpiryTimeUtc: null,
    connectedAtUtc: null,
  });
}

function createErrorStatus(detail: string): ExchangeConnectionStatus {
  return exchangeConnectionStatusSchema.parse({
    state: 'error',
    detail,
    runtime: null,
    userPrincipalName: null,
    connectionId: null,
    tenantId: null,
    tokenStatus: null,
    tokenExpiryTimeUtc: null,
    connectedAtUtc: null,
  });
}

export class ExchangeSessionManager {
  private host: ExchangeSessionHost | null = null;
  private operationQueue: Promise<void> = Promise.resolve();

  async connect(payload: ExchangeConnectPayload): Promise<ExchangeConnectionStatus> {
    return await this.runExclusive(async () => {
      try {
        const host = await this.ensureHost();
        const rawStatus = await host.request('connect', payload);

        return parseConnectionStatus(rawStatus, host.runtime);
      } catch (error) {
        await this.disposeHost();

        return createErrorStatus(
          error instanceof Error ? error.message : 'Exchange connection failed.',
        );
      }
    });
  }

  async getConnectionStatus(): Promise<ExchangeConnectionStatus> {
    return await this.runExclusive(async () => {
      if (!this.host) {
        return createDisconnectedStatus('Exchange session host is not running.');
      }

      try {
        const rawStatus = await this.host.request('getStatus', {});

        return parseConnectionStatus(rawStatus, this.host.runtime);
      } catch {
        await this.disposeHost();

        return createDisconnectedStatus('Exchange session host is unavailable.');
      }
    });
  }

  async disconnect(): Promise<ExchangeConnectionStatus> {
    return await this.runExclusive(async () => {
      if (!this.host) {
        return createDisconnectedStatus('Exchange session host is not running.');
      }

      try {
        const rawStatus = await this.host.request('disconnect', {});

        return parseConnectionStatus(rawStatus, this.host.runtime);
      } catch {
        return createDisconnectedStatus('Exchange session host was cleared after a disconnect failure.');
      } finally {
        await this.disposeHost();
      }
    });
  }

  async shutdown(): Promise<void> {
    await this.runExclusive(async () => {
      await this.disposeHost();
    });
  }

  private async ensureHost(): Promise<ExchangeSessionHost> {
    if (!this.host) {
      this.host = await startExchangeSessionHost();
    }

    return this.host;
  }

  private async disposeHost(): Promise<void> {
    if (!this.host) {
      return;
    }

    const host = this.host;
    this.host = null;
    await host.dispose();
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

export const exchangeSessionManager = new ExchangeSessionManager();

function parseConnectionStatus(
  rawStatus: unknown,
  runtime: ExchangeSessionHost['runtime'],
): ExchangeConnectionStatus {
  const record = rawStatus as Record<string, unknown>;
  const psVersion = typeof record.psVersion === 'string' ? record.psVersion : null;
  const psEdition = typeof record.psEdition === 'string' ? record.psEdition : null;

  return exchangeConnectionStatusSchema.parse({
    ...record,
    runtime:
      psVersion && psEdition
        ? {
            ...runtime,
            version: psVersion,
            edition: psEdition,
          }
        : null,
  });
}
