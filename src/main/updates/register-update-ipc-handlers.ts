import { ipcMain } from 'electron';

import { updateStatusSchema } from '@/shared/contracts/updates';

import {
  UPDATE_STATUS_CHANNEL,
  checkForUpdates,
  getUpdateStatus,
  installDownloadedUpdate,
} from './update-manager';
import { validateEventSender } from '@/main/ipc/validate-event-sender';

const UPDATE_GET_STATUS_CHANNEL = 'groups-console:updates:get-status';
const UPDATE_CHECK_CHANNEL = 'groups-console:updates:check';
const UPDATE_INSTALL_CHANNEL = 'groups-console:updates:install';

export function registerUpdateIpcHandlers(): void {
  ipcMain.handle(UPDATE_GET_STATUS_CHANNEL, (event) => {
    if (!validateEventSender(event)) {
      throw new Error('IPC sender was rejected by the application security policy.');
    }

    return updateStatusSchema.parse(getUpdateStatus());
  });

  ipcMain.handle(UPDATE_CHECK_CHANNEL, (event) => {
    if (!validateEventSender(event)) {
      throw new Error('IPC sender was rejected by the application security policy.');
    }

    return updateStatusSchema.parse(checkForUpdates());
  });

  ipcMain.handle(UPDATE_INSTALL_CHANNEL, (event) => {
    if (!validateEventSender(event)) {
      throw new Error('IPC sender was rejected by the application security policy.');
    }

    return updateStatusSchema.parse(installDownloadedUpdate());
  });
}

export {
  UPDATE_CHECK_CHANNEL,
  UPDATE_GET_STATUS_CHANNEL,
  UPDATE_INSTALL_CHANNEL,
  UPDATE_STATUS_CHANNEL,
};
