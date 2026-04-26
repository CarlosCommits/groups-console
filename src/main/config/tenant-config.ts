import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';

import {
  getGroupsConsoleDevTenantConfigPath,
  getGroupsConsoleTenantConfigPath,
} from '@/main/app/paths';
import { isPackagedRuntime } from '@/main/app/runtime-mode';
import { tenantConfigSchema, type TenantConfig } from '@/shared/contracts/graph';

async function resolveTenantConfigPath(): Promise<string> {
  const primaryPath = getGroupsConsoleTenantConfigPath();

  try {
    await access(primaryPath, fsConstants.R_OK);
    return primaryPath;
  } catch (error) {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error) ||
      error.code !== 'ENOENT'
    ) {
      throw error;
    }

    if (isPackagedRuntime()) {
      throw error;
    }

    const devFallbackPath = getGroupsConsoleDevTenantConfigPath();
    await access(devFallbackPath, fsConstants.R_OK);
    return devFallbackPath;
  }
}

export async function loadTenantConfig(): Promise<TenantConfig> {
  const tenantConfigPath = await resolveTenantConfigPath();
  const rawFile = await readFile(tenantConfigPath, 'utf8');

  return tenantConfigSchema.parse(JSON.parse(rawFile) as unknown);
}
