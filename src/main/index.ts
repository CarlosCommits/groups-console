import { app, BrowserWindow } from 'electron';
import started from 'electron-squirrel-startup';

import { createMainWindow } from './app/create-main-window';
import { registerIpcHandlers } from './ipc/register-ipc-handlers';

if (started) {
  app.quit();
}

void app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.radapp.desktop');
  }

  registerIpcHandlers();
  createMainWindow();

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
