import { app, BrowserWindow, Menu } from 'electron';
import started from 'electron-squirrel-startup';

import { exchangeSessionManager } from '@/main/exchange/exchange-session-manager';
import { graphSessionManager } from '@/main/graph/graph-session-manager';

import { createMainWindow } from './app/create-main-window';
import { registerIpcHandlers } from './ipc/register-ipc-handlers';
import { registerUpdateIpcHandlers } from './updates/register-update-ipc-handlers';
import { initializeUpdates, shutdownUpdates } from './updates/update-manager';

if (started) {
  app.quit();
}

void app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.groupsconsole.desktop');
  }

  registerIpcHandlers();
  registerUpdateIpcHandlers();
  Menu.setApplicationMenu(null);
  createMainWindow();
  initializeUpdates();

  app.on('activate', () => {
    if (process.platform === 'darwin' && BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  shutdownUpdates();
  void exchangeSessionManager.shutdown();
  void graphSessionManager.shutdown();
});
