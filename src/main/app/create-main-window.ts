import path from 'node:path';
import { BrowserWindow, shell, type BrowserWindowConstructorOptions } from 'electron';

import { registerTrustedWebContents } from '@/main/ipc/trusted-senders';

import { isPackagedRuntime } from './runtime-mode';

export function getMainWindowOptions(): BrowserWindowConstructorOptions {
  return {
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    title: 'Groups Console',
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  };
}

export function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow(getMainWindowOptions());

  registerTrustedWebContents(mainWindow.webContents.id);

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);

    return { action: 'deny' };
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  if (!isPackagedRuntime()) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  return mainWindow;
}
