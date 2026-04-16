import { contextBridge, ipcRenderer } from 'electron';

import { commandResponseSchema, progressEventSchema, type ProgressEvent } from '@/shared/contracts/command';
import {
  diagnosticsExportResultSchema,
  type DiagnosticsExportPayload,
  type DiagnosticsExportResult,
} from '@/shared/contracts/diagnostics';
import {
  contactsGetDetailsResultSchema,
  contactsCreateResultSchema,
  contactsUpdateCompanyResultSchema,
  type ContactsGetDetailsPayload,
  type ContactsGetDetailsResult,
  type ContactsCreatePayload,
  type ContactsCreateResult,
  type ContactsUpdateCompanyPayload,
  type ContactsUpdateCompanyResult,
} from '@/shared/contracts/contacts';
import {
  graphConnectionStatusSchema,
  type GraphConnectionStatus,
} from '@/shared/contracts/graph';
import {
  guestsGetDetailsResultSchema,
  guestsInviteResultSchema,
  guestsSearchResultSchema,
  type GuestsGetDetailsPayload,
  type GuestsGetDetailsResult,
  type GuestsInvitePayload,
  type GuestsInviteResult,
  type GuestsSearchPayload,
  type GuestsSearchResult,
  guestsUpdateCompanyResultSchema,
  type GuestsUpdateCompanyPayload,
  type GuestsUpdateCompanyResult,
} from '@/shared/contracts/guests';
import {
  recipientsSearchResultSchema,
  type RecipientsSearchPayload,
  type RecipientsSearchResult,
} from '@/shared/contracts/recipients';
import {
  exchangeCapabilitiesSchema,
  exchangeConnectionStatusSchema,
  exchangeRecipientGetDetailsResultSchema,
  type ExchangeGroupRef,
  type ExchangeRecipientGetDetailsPayload,
  type ExchangeRecipientGetDetailsResult,
  exchangeListGroupsResultSchema,
  groupsAddMembersResultSchema,
  groupsGetMembersResultSchema,
  groupsRemoveMembersResultSchema,
  type ExchangeCapabilities,
  type ExchangeConnectionStatus,
  type ExchangeListGroupsResult,
  type GroupMemberSelectionRef,
  type GroupMemberWriteRef,
  type GroupsAddMembersResult,
  type GroupsGetMembersResult,
  type GroupsRemoveMembersResult,
} from '@/shared/contracts/exchange';
import { sessionStatusSchema, type SessionStatusSchema } from '@/shared/contracts/session';
import {
  reportsGenerateMembershipMatrixResultSchema,
  type ReportsGenerateMembershipMatrixPayload,
  type ReportsGenerateMembershipMatrixResult,
} from '@/shared/contracts/reports';
import { createCommandRequest } from '@/shared/validation/create-command-request';

import { createCommandFailure } from './command-failure';

const COMMAND_CHANNEL = 'radapp:command';
const PROGRESS_CHANNEL = 'radapp:progress';

const radAppApi = {
  session: {
    async getStatus(): Promise<SessionStatusSchema> {
      const request = createCommandRequest('session.getStatus', {});
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw createCommandFailure(response.error, 'Unable to load application status.');
      }

      return sessionStatusSchema.parse(response.data);
    },
  },
  exchange: {
    async getCapabilities(): Promise<ExchangeCapabilities> {
      const request = createCommandRequest('exchange.getCapabilities', {});
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw createCommandFailure(response.error, 'Unable to load Exchange capabilities.');
      }

      return exchangeCapabilitiesSchema.parse(response.data);
    },
    async connect(userPrincipalName: string): Promise<ExchangeConnectionStatus> {
      const request = createCommandRequest('exchange.connect', {
        userPrincipalName,
      });
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw createCommandFailure(response.error, 'Unable to connect to Exchange Online.');
      }

      return exchangeConnectionStatusSchema.parse(response.data);
    },
    async getConnectionStatus(): Promise<ExchangeConnectionStatus> {
      const request = createCommandRequest('exchange.getConnectionStatus', {});
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw createCommandFailure(response.error, 'Unable to load Exchange connection status.');
      }

      return exchangeConnectionStatusSchema.parse(response.data);
    },
    async disconnect(): Promise<ExchangeConnectionStatus> {
      const request = createCommandRequest('exchange.disconnect', {});
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw createCommandFailure(response.error, 'Unable to disconnect from Exchange Online.');
      }

      return exchangeConnectionStatusSchema.parse(response.data);
    },
    async listGroups(
      kind?: 'all' | 'distributionList' | 'mailEnabledSecurityGroup',
    ): Promise<ExchangeListGroupsResult> {
      const request = createCommandRequest('exchange.listGroups', kind ? { kind } : {});
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw createCommandFailure(response.error, 'Unable to list Exchange groups.');
      }

      return exchangeListGroupsResultSchema.parse(response.data);
    },
    async getRecipientDetails(
      payload: ExchangeRecipientGetDetailsPayload,
    ): Promise<ExchangeRecipientGetDetailsResult> {
      const request = createCommandRequest('exchange.getRecipientDetails', payload);
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw createCommandFailure(response.error, 'Unable to read Exchange recipient details.');
      }

      return exchangeRecipientGetDetailsResultSchema.parse(response.data);
    },
  },
  graph: {
    async connect(): Promise<GraphConnectionStatus> {
      const request = createCommandRequest('graph.connect', {});
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw createCommandFailure(response.error, 'Unable to connect to Microsoft Graph.');
      }

      return graphConnectionStatusSchema.parse(response.data);
    },
    async getConnectionStatus(): Promise<GraphConnectionStatus> {
      const request = createCommandRequest('graph.getConnectionStatus', {});
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw createCommandFailure(response.error, 'Unable to load Microsoft Graph connection status.');
      }

      return graphConnectionStatusSchema.parse(response.data);
    },
    async disconnect(): Promise<GraphConnectionStatus> {
      const request = createCommandRequest('graph.disconnect', {});
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw createCommandFailure(response.error, 'Unable to disconnect from Microsoft Graph.');
      }

      return graphConnectionStatusSchema.parse(response.data);
    },
  },
  groups: {
    async getMembers(group: ExchangeGroupRef): Promise<GroupsGetMembersResult> {
      const request = createCommandRequest('groups.getMembers', { group });
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw createCommandFailure(response.error, 'Unable to read group members.');
      }

      return groupsGetMembersResultSchema.parse(response.data);
    },
    async addMembers(
      group: ExchangeGroupRef,
      members: GroupMemberSelectionRef[],
    ): Promise<GroupsAddMembersResult> {
      const request = createCommandRequest('groups.addMembers', {
        group,
        members,
        verify: true,
      });
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw createCommandFailure(response.error, 'Unable to add group members.');
      }

      return groupsAddMembersResultSchema.parse(response.data);
    },
    async removeMembers(
      group: ExchangeGroupRef,
      members: GroupMemberWriteRef[],
    ): Promise<GroupsRemoveMembersResult> {
      const request = createCommandRequest('groups.removeMembers', {
        group,
        members,
        verify: true,
      });
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw createCommandFailure(response.error, 'Unable to remove group members.');
      }

      return groupsRemoveMembersResultSchema.parse(response.data);
    },
  },
  guests: {
    async search(payload: GuestsSearchPayload): Promise<GuestsSearchResult> {
      const request = createCommandRequest('guests.search', payload);
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw createCommandFailure(response.error, 'Unable to search guest users.');
      }

      return guestsSearchResultSchema.parse(response.data);
    },
    async invite(payload: GuestsInvitePayload): Promise<GuestsInviteResult> {
      const request = createCommandRequest('guests.invite', payload);
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw createCommandFailure(response.error, 'Unable to invite guest user.');
      }

      return guestsInviteResultSchema.parse(response.data);
    },
    async getDetails(payload: GuestsGetDetailsPayload): Promise<GuestsGetDetailsResult> {
      const request = createCommandRequest(
        'guests.getDetails' as Parameters<typeof createCommandRequest>[0],
        payload,
      );
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw createCommandFailure(response.error, 'Unable to read guest details.');
      }

      return guestsGetDetailsResultSchema.parse(response.data);
    },
    async updateCompany(payload: GuestsUpdateCompanyPayload): Promise<GuestsUpdateCompanyResult> {
      const request = createCommandRequest('guests.updateCompany', payload);
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw createCommandFailure(response.error, 'Unable to update guest company.');
      }

      return guestsUpdateCompanyResultSchema.parse(response.data);
    },
  },
  contacts: {
    async getDetails(payload: ContactsGetDetailsPayload): Promise<ContactsGetDetailsResult> {
      const request = createCommandRequest(
        'contacts.getDetails' as Parameters<typeof createCommandRequest>[0],
        payload,
      );
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw createCommandFailure(response.error, 'Unable to read contact details.');
      }

      return contactsGetDetailsResultSchema.parse(response.data);
    },
    async create(payload: ContactsCreatePayload): Promise<ContactsCreateResult> {
      const request = createCommandRequest('contacts.create', payload);
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw createCommandFailure(response.error, 'Unable to create contact.');
      }

      return contactsCreateResultSchema.parse(response.data);
    },
    async updateCompany(
      payload: ContactsUpdateCompanyPayload,
    ): Promise<ContactsUpdateCompanyResult> {
      const request = createCommandRequest('contacts.updateCompany', payload);
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw createCommandFailure(response.error, 'Unable to update contact company.');
      }

      return contactsUpdateCompanyResultSchema.parse(response.data);
    },
  },
  reports: {
    async generateMembershipMatrix(
      payload: ReportsGenerateMembershipMatrixPayload,
      onProgress?: (event: ProgressEvent) => void,
    ): Promise<ReportsGenerateMembershipMatrixResult> {
      const request = createCommandRequest('reports.generateMembershipMatrix', payload);
      const progressListener = (_event: Electron.IpcRendererEvent, rawProgress: unknown) => {
        if (!onProgress) {
          return;
        }

        const progress = progressEventSchema.parse(rawProgress);
        if (progress.requestId !== request.requestId) {
          return;
        }

        onProgress(progress);
      };

      ipcRenderer.on(PROGRESS_CHANNEL, progressListener);

      try {
        const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
        const response = commandResponseSchema.parse(rawResponse);

        if (!response.success) {
          throw createCommandFailure(
            response.error,
            'Unable to generate membership matrix report.',
          );
        }

        return reportsGenerateMembershipMatrixResultSchema.parse(response.data);
      } finally {
        ipcRenderer.removeListener(PROGRESS_CHANNEL, progressListener);
      }
    },
  },
  diagnostics: {
    async export(payload: DiagnosticsExportPayload = {}): Promise<DiagnosticsExportResult> {
      const request = createCommandRequest('diagnostics.export' as Parameters<typeof createCommandRequest>[0], payload);
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw createCommandFailure(response.error, 'Unable to export diagnostics.');
      }

      return diagnosticsExportResultSchema.parse(response.data);
    },
  },
  recipients: {
    async search(payload: RecipientsSearchPayload): Promise<RecipientsSearchResult> {
      const request = createCommandRequest('recipients.search', payload);
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw createCommandFailure(response.error, 'Unable to search recipients.');
      }

      return recipientsSearchResultSchema.parse(response.data);
    },
  },
};

contextBridge.exposeInMainWorld('radApp', radAppApi);
