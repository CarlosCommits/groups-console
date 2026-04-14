import { contextBridge, ipcRenderer } from 'electron';

import { commandResponseSchema } from '@/shared/contracts/command';
import {
  contactsCreateResultSchema,
  contactsUpdateCompanyResultSchema,
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
  guestsInviteResultSchema,
  guestsSearchResultSchema,
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
  type ExchangeGroupRef,
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
import { createCommandRequest } from '@/shared/validation/create-command-request';

const COMMAND_CHANNEL = 'radapp:command';

const radAppApi = {
  session: {
    async getStatus(): Promise<SessionStatusSchema> {
      const request = createCommandRequest('session.getStatus', {});
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw new Error(response.error?.message ?? 'Unable to load application status.');
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
        throw new Error(response.error?.message ?? 'Unable to load Exchange capabilities.');
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
        throw new Error(response.error?.message ?? 'Unable to connect to Exchange Online.');
      }

      return exchangeConnectionStatusSchema.parse(response.data);
    },
    async getConnectionStatus(): Promise<ExchangeConnectionStatus> {
      const request = createCommandRequest('exchange.getConnectionStatus', {});
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw new Error(response.error?.message ?? 'Unable to load Exchange connection status.');
      }

      return exchangeConnectionStatusSchema.parse(response.data);
    },
    async disconnect(): Promise<ExchangeConnectionStatus> {
      const request = createCommandRequest('exchange.disconnect', {});
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw new Error(response.error?.message ?? 'Unable to disconnect from Exchange Online.');
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
        throw new Error(response.error?.message ?? 'Unable to list Exchange groups.');
      }

      return exchangeListGroupsResultSchema.parse(response.data);
    },
  },
  graph: {
    async connect(): Promise<GraphConnectionStatus> {
      const request = createCommandRequest('graph.connect', {});
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw new Error(response.error?.message ?? 'Unable to connect to Microsoft Graph.');
      }

      return graphConnectionStatusSchema.parse(response.data);
    },
    async getConnectionStatus(): Promise<GraphConnectionStatus> {
      const request = createCommandRequest('graph.getConnectionStatus', {});
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw new Error(response.error?.message ?? 'Unable to load Microsoft Graph connection status.');
      }

      return graphConnectionStatusSchema.parse(response.data);
    },
    async disconnect(): Promise<GraphConnectionStatus> {
      const request = createCommandRequest('graph.disconnect', {});
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw new Error(response.error?.message ?? 'Unable to disconnect from Microsoft Graph.');
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
        throw new Error(response.error?.message ?? 'Unable to read group members.');
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
        throw new Error(response.error?.message ?? 'Unable to add group members.');
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
        throw new Error(response.error?.message ?? 'Unable to remove group members.');
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
        throw new Error(response.error?.message ?? 'Unable to search guest users.');
      }

      return guestsSearchResultSchema.parse(response.data);
    },
    async invite(payload: GuestsInvitePayload): Promise<GuestsInviteResult> {
      const request = createCommandRequest('guests.invite', payload);
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw new Error(response.error?.message ?? 'Unable to invite guest user.');
      }

      return guestsInviteResultSchema.parse(response.data);
    },
    async updateCompany(payload: GuestsUpdateCompanyPayload): Promise<GuestsUpdateCompanyResult> {
      const request = createCommandRequest('guests.updateCompany', payload);
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw new Error(response.error?.message ?? 'Unable to update guest company.');
      }

      return guestsUpdateCompanyResultSchema.parse(response.data);
    },
  },
  contacts: {
    async create(payload: ContactsCreatePayload): Promise<ContactsCreateResult> {
      const request = createCommandRequest('contacts.create', payload);
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw new Error(response.error?.message ?? 'Unable to create contact.');
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
        throw new Error(response.error?.message ?? 'Unable to update contact company.');
      }

      return contactsUpdateCompanyResultSchema.parse(response.data);
    },
  },
  recipients: {
    async search(payload: RecipientsSearchPayload): Promise<RecipientsSearchResult> {
      const request = createCommandRequest('recipients.search', payload);
      const rawResponse: unknown = await ipcRenderer.invoke(COMMAND_CHANNEL, request);
      const response = commandResponseSchema.parse(rawResponse);

      if (!response.success) {
        throw new Error(response.error?.message ?? 'Unable to search recipients.');
      }

      return recipientsSearchResultSchema.parse(response.data);
    },
  },
};

contextBridge.exposeInMainWorld('radApp', radAppApi);
