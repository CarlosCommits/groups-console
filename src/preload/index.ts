import { contextBridge, ipcRenderer } from 'electron';

import { commandResponseSchema } from '@/shared/contracts/command';
import {
  exchangeCapabilitiesSchema,
  exchangeConnectionStatusSchema,
  exchangeListGroupsResultSchema,
  type ExchangeCapabilities,
  type ExchangeConnectionStatus,
  type ExchangeListGroupsResult,
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
};

contextBridge.exposeInMainWorld('radApp', radAppApi);
