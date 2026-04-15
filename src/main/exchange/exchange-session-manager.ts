import {
  exchangeConnectionStatusSchema,
  type ExchangeConnectPayload,
  type ExchangeConnectionStatus,
  exchangeListGroupsResultSchema,
  guestMembershipTargetResultSchema,
  groupsGetMembersResultSchema,
  groupsAddMembersResultSchema,
  groupsRemoveMembersResultSchema,
  type ExchangeListGroupsPayload,
  type ExchangeListGroupsResult,
  type GuestMembershipTargetResult,
  type GroupsAddMembersResult,
  type GroupsGetMembersPayload,
  type GroupsGetMembersResult,
  type ResolvedGroupsAddMembersPayload,
  type GroupsRemoveMembersPayload,
  type GroupsRemoveMembersResult,
} from '@/shared/contracts/exchange';
import {
  contactsGetDetailsResultSchema,
  contactsCreateResultSchema,
  contactsUpdateCompanyResultSchema,
  type ContactsGetDetailsResult,
  type ContactsCreatePayload,
  type ContactsCreateResult,
  type ContactsUpdateCompanyPayload,
  type ContactsUpdateCompanyResult,
} from '@/shared/contracts/contacts';
import {
  recipientConflictLookupResultSchema,
  type RecipientConflictRecord,
} from '@/shared/contracts/conflicts';
import {
  recipientsSearchResultSchema,
  type RecipientsSearchPayload,
  type RecipientsSearchResult,
} from '@/shared/contracts/recipients';
import {
  reportMembershipMatrixDataSchema,
  type ReportMembershipMatrixData,
  type ReportsGenerateMembershipMatrixPayload,
} from '@/shared/contracts/reports';
import type { ProgressEvent } from '@/shared/contracts/command';

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

  async listGroups(payload: ExchangeListGroupsPayload): Promise<ExchangeListGroupsResult> {
    return await this.runExclusive(async () => {
      if (!this.host) {
        throw new Error('Exchange session host is not running. Connect to Exchange Online first.');
      }

      const rawResult = await this.host.request('listGroups', payload);

      return exchangeListGroupsResultSchema.parse(rawResult);
    });
  }

  async searchRecipients(payload: RecipientsSearchPayload): Promise<RecipientsSearchResult> {
    return await this.runExclusive(async () => {
      if (!this.host) {
        throw new Error('Exchange session host is not running. Connect to Exchange Online first.');
      }

      const rawResult = await this.host.request('searchRecipients', payload);

      return recipientsSearchResultSchema.parse(rawResult);
    });
  }

  async exportReportData(
    payload: ReportsGenerateMembershipMatrixPayload,
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<ReportMembershipMatrixData> {
    return await this.runExclusive(async () => {
      if (!this.host) {
        throw new Error('Exchange session host is not running. Connect to Exchange Online first.');
      }

      const rawResult = await this.host.request('exportReportData', payload as Record<string, unknown>, onProgress);

      return reportMembershipMatrixDataSchema.parse(rawResult);
    });
  }

  async getGroupMembers(payload: GroupsGetMembersPayload): Promise<GroupsGetMembersResult> {
    return await this.runExclusive(async () => {
      if (!this.host) {
        throw new Error('Exchange session host is not running. Connect to Exchange Online first.');
      }

      const rawResult = await this.host.request('getGroupMembers', payload);

      return groupsGetMembersResultSchema.parse(rawResult);
    });
  }

  async addMembers(payload: ResolvedGroupsAddMembersPayload): Promise<GroupsAddMembersResult> {
    return await this.runExclusive(async () => {
      if (!this.host) {
        throw new Error('Exchange session host is not running. Connect to Exchange Online first.');
      }

      const rawResult = await this.host.request('addGroupMembers', payload);

      return groupsAddMembersResultSchema.parse(rawResult);
    });
  }

  async createContact(payload: ContactsCreatePayload): Promise<ContactsCreateResult> {
    return await this.runExclusive(async () => {
      if (!this.host) {
        throw new Error('Exchange session host is not running. Connect to Exchange Online first.');
      }

      const rawResult = await this.host.request('createContact', payload as unknown as Record<string, unknown>);

      return contactsCreateResultSchema.parse(rawResult);
    });
  }

  async getContactDetails(exchangeIdentity: string): Promise<ContactsGetDetailsResult> {
    return await this.runExclusive(async () => {
      if (!this.host) {
        throw new Error('Exchange session host is not running. Connect to Exchange Online first.');
      }

      const rawResult = await this.host.request(
        'getContactDetails' as Parameters<ExchangeSessionHost['request']>[0],
        { exchangeIdentity },
      );

      return contactsGetDetailsResultSchema.parse(rawResult);
    });
  }

  async lookupRecipientOwnershipByEmail(email: string): Promise<RecipientConflictRecord[]> {
    return await this.runExclusive(async () => {
      if (!this.host) {
        throw new Error('Exchange session host is not running. Connect to Exchange Online first.');
      }

      const rawResult = await this.host.request(
        'lookupRecipientOwnership' as Parameters<ExchangeSessionHost['request']>[0],
        { email },
      );
      const result = recipientConflictLookupResultSchema.parse(rawResult);

      return result.records;
    });
  }

  async resolveGuestMailUserByObjectId(
    objectId: string,
    primaryEmail: string | null,
  ): Promise<GuestMembershipTargetResult> {
    return await this.runExclusive(async () => {
      if (!this.host) {
        throw new Error('Exchange session host is not running. Connect to Exchange Online first.');
      }

      const rawResult = await this.host.request('resolveGuestMailUser', {
        objectId,
        primaryEmail,
      });

      return guestMembershipTargetResultSchema.parse(rawResult);
    });
  }

  async updateContactCompany(
    payload: ContactsUpdateCompanyPayload,
  ): Promise<ContactsUpdateCompanyResult> {
    return await this.runExclusive(async () => {
      if (!this.host) {
        throw new Error('Exchange session host is not running. Connect to Exchange Online first.');
      }

      const rawResult = await this.host.request(
        'updateContactCompany',
        payload as unknown as Record<string, unknown>,
      );

      return contactsUpdateCompanyResultSchema.parse(rawResult);
    });
  }

  async removeMembers(payload: GroupsRemoveMembersPayload): Promise<GroupsRemoveMembersResult> {
    return await this.runExclusive(async () => {
      if (!this.host) {
        throw new Error('Exchange session host is not running. Connect to Exchange Online first.');
      }

      const rawResult = await this.host.request('removeGroupMembers', payload);

      return groupsRemoveMembersResultSchema.parse(rawResult);
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
