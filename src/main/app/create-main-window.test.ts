import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';

vi.mock('electron', () => ({
  app: { isPackaged: false },
  BrowserWindow: vi.fn(),
  shell: { openExternal: vi.fn() },
}));

import { getMainWindowOptions } from './create-main-window';

describe('getMainWindowOptions', () => {
  it('locks down privileged renderer access', () => {
    const options = getMainWindowOptions();

    expect(options.webPreferences?.contextIsolation).toBe(true);
    expect(options.webPreferences?.sandbox).toBe(true);
    expect(options.webPreferences?.nodeIntegration).toBe(false);
  });

  it('points BrowserWindow to the built preload bundle', () => {
    const options = getMainWindowOptions();

    expect(options.webPreferences?.preload).toBe(path.join(__dirname, 'preload.js'));
  });

  it('uses branded window chrome without a visible native menu bar', () => {
    const options = getMainWindowOptions();

    expect(options.autoHideMenuBar).toBe(true);
    expect(options.titleBarStyle).toBe('hidden');
    expect(options.titleBarOverlay).toEqual({
      color: '#00504a',
      symbolColor: '#ffffff',
    });
  });
});
