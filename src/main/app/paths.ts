import path from 'node:path';

import { app } from 'electron';

import { isPackagedRuntime } from './runtime-mode';

export function getRadAppConfigDirectory(): string {
  return path.join(app.getPath('userData'), 'config');
}

export function getRadAppTenantConfigPath(): string {
  return path.join(getRadAppConfigDirectory(), 'tenant.json');
}

export function getRadAppDevTenantConfigPath(): string {
  return path.join(app.getAppPath(), 'config', 'tenant.json');
}

export function getRadAppLogDirectory(): string {
  return path.join(app.getPath('userData'), 'logs');
}

export function getRadAppPowerShellAssetRoot(): string {
  if (isPackagedRuntime()) {
    return path.join(process.resourcesPath, 'powershell');
  }

  return path.join(app.getAppPath(), 'powershell');
}

export function getRadAppWorkerScriptPath(): string {
  return path.join(getRadAppPowerShellAssetRoot(), 'bootstrap', 'worker.ps1');
}
