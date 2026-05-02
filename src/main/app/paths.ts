import path from 'node:path';

import { app } from 'electron';

import { isPackagedRuntime } from './runtime-mode';

export function getGroupsConsoleConfigDirectory(): string {
  return path.join(app.getPath('userData'), 'config');
}

export function getGroupsConsoleTenantConfigPath(): string {
  return path.join(getGroupsConsoleConfigDirectory(), 'tenant.json');
}

export function getGroupsConsoleDevTenantConfigPath(): string {
  return path.join(app.getAppPath(), 'config', 'tenant.json');
}

export function getGroupsConsoleBundledTenantConfigPath(): string {
  if (isPackagedRuntime()) {
    return path.join(process.resourcesPath, 'config', 'tenant.json');
  }

  return getGroupsConsoleDevTenantConfigPath();
}

export function getGroupsConsoleLogDirectory(): string {
  return path.join(app.getPath('userData'), 'logs');
}

export function getGroupsConsoleAuthDirectory(): string {
  return path.join(app.getPath('userData'), 'auth');
}

export function getGroupsConsoleGraphCachePath(): string {
  return path.join(getGroupsConsoleAuthDirectory(), 'graph-msal-cache.bin');
}

export function getGroupsConsoleGraphAccountPath(): string {
  return path.join(getGroupsConsoleAuthDirectory(), 'graph-account.json');
}

export function getGroupsConsolePowerShellAssetRoot(): string {
  if (isPackagedRuntime()) {
    return path.join(process.resourcesPath, 'powershell');
  }

  return path.join(app.getAppPath(), 'powershell');
}

export function getGroupsConsoleWorkerScriptPath(): string {
  return path.join(getGroupsConsolePowerShellAssetRoot(), 'bootstrap', 'worker.ps1');
}
