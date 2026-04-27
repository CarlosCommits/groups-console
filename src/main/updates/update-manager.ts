import { app, autoUpdater, BrowserWindow } from 'electron';

import { updateStatusSchema, type UpdateStatus } from '@/shared/contracts/updates';

const UPDATE_STATUS_CHANNEL = 'groups-console:updates:status';
const UPDATE_SERVER = 'https://update.electronjs.org';
const UPDATE_REPOSITORY = 'CarlosCommits/groups-console';
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const INITIAL_UPDATE_CHECK_DELAY_MS = 10 * 1000;

let status: UpdateStatus = createStatus({
  state: 'idle',
  detail: null,
  canCheck: true,
});
let configured = false;
let checking = false;
let interval: NodeJS.Timeout | null = null;
let initialCheck: NodeJS.Timeout | null = null;

function createStatus(
  input: Omit<UpdateStatus, 'currentVersion' | 'updateVersion' | 'checkedAt' | 'canInstall'> & {
    updateVersion?: string | null;
    checkedAt?: string | null;
    canInstall?: boolean;
  },
): UpdateStatus {
  return updateStatusSchema.parse({
    ...input,
    currentVersion: app.getVersion(),
    updateVersion: input.updateVersion ?? null,
    checkedAt: input.checkedAt ?? null,
    canInstall: input.canInstall ?? false,
  });
}

function setStatus(next: UpdateStatus): UpdateStatus {
  status = updateStatusSchema.parse(next);
  broadcastStatus();
  return status;
}

function patchStatus(
  patch: Partial<Omit<UpdateStatus, 'currentVersion'>>,
): UpdateStatus {
  return setStatus(
    updateStatusSchema.parse({
      ...status,
      ...patch,
      currentVersion: app.getVersion(),
    }),
  );
}

function broadcastStatus(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(UPDATE_STATUS_CHANNEL, status);
    }
  }
}

function clearUpdateCheckTimers(): void {
  if (initialCheck) {
    clearTimeout(initialCheck);
    initialCheck = null;
  }

  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

function getUnsupportedDetail(): string | null {
  if (!app.isPackaged) {
    return 'Updates are available only in packaged builds.';
  }

  if (process.platform !== 'win32' && process.platform !== 'darwin') {
    return `Updates are not supported on ${process.platform}.`;
  }

  return null;
}

function getFeedUrl(): string {
  return `${UPDATE_SERVER}/${UPDATE_REPOSITORY}/${process.platform}-${process.arch}/${app.getVersion()}`;
}

function configureAutoUpdater(): void {
  if (configured) {
    return;
  }

  const unsupportedDetail = getUnsupportedDetail();
  if (unsupportedDetail) {
    configured = true;
    setStatus(createStatus({
      state: 'unsupported',
      detail: unsupportedDetail,
      canCheck: false,
    }));
    return;
  }

  autoUpdater.setFeedURL({ url: getFeedUrl() });

  autoUpdater.on('checking-for-update', () => {
    checking = true;
    patchStatus({
      state: 'checking',
      detail: 'Checking for updates.',
      checkedAt: new Date().toISOString(),
      canCheck: true,
      canInstall: false,
    });
  });

  autoUpdater.on('update-available', () => {
    patchStatus({
      state: 'available',
      detail: 'An update is available and is downloading.',
      checkedAt: new Date().toISOString(),
      canCheck: false,
      canInstall: false,
    });
  });

  autoUpdater.on('update-not-available', () => {
    checking = false;
    patchStatus({
      state: 'notAvailable',
      detail: 'Groups Console is up to date.',
      checkedAt: new Date().toISOString(),
      updateVersion: null,
      canCheck: true,
      canInstall: false,
    });
  });

  autoUpdater.on('update-downloaded', (_event, _releaseNotes, releaseName) => {
    checking = false;
    clearUpdateCheckTimers();
    patchStatus({
      state: 'downloaded',
      detail: 'An update has been downloaded. Restart Groups Console to install it.',
      checkedAt: new Date().toISOString(),
      updateVersion: releaseName || null,
      canCheck: false,
      canInstall: true,
    });
  });

  autoUpdater.on('error', (error) => {
    checking = false;
    patchStatus({
      state: 'error',
      detail: error.message || 'Update check failed.',
      checkedAt: new Date().toISOString(),
      canCheck: true,
      canInstall: false,
    });
  });

  configured = true;
}

export function initializeUpdates(): void {
  configureAutoUpdater();

  if (!status.canCheck) {
    return;
  }

  if (initialCheck || interval) {
    return;
  }

  initialCheck = setTimeout(() => {
    checkForUpdates();
  }, INITIAL_UPDATE_CHECK_DELAY_MS);

  interval = setInterval(() => {
    checkForUpdates();
  }, UPDATE_CHECK_INTERVAL_MS);
}

export function shutdownUpdates(): void {
  clearUpdateCheckTimers();
}

export function getUpdateStatus(): UpdateStatus {
  configureAutoUpdater();
  return status;
}

export function checkForUpdates(): UpdateStatus {
  configureAutoUpdater();

  if (!status.canCheck) {
    return status;
  }

  if (checking) {
    return status;
  }

  try {
    checking = true;
    autoUpdater.checkForUpdates();
  } catch (error) {
    checking = false;
    return patchStatus({
      state: 'error',
      detail: error instanceof Error ? error.message : 'Update check failed.',
      checkedAt: new Date().toISOString(),
      canCheck: true,
      canInstall: false,
    });
  }

  return status;
}

export function installDownloadedUpdate(): UpdateStatus {
  configureAutoUpdater();

  if (!status.canInstall) {
    return status;
  }

  autoUpdater.quitAndInstall();
  return status;
}

export { UPDATE_STATUS_CHANNEL };
