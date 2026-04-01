import { contextBridge, ipcRenderer } from 'electron';

import { commandResponseSchema } from '@/shared/contracts/command';
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
};

contextBridge.exposeInMainWorld('radApp', radAppApi);
