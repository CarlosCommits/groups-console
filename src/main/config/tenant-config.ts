import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';

import {
  getGroupsConsoleBundledTenantConfigPath,
  getGroupsConsoleTenantConfigPath,
} from '@/main/app/paths';
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

    const bundledConfigPath = getGroupsConsoleBundledTenantConfigPath();
    await access(bundledConfigPath, fsConstants.R_OK);
    return bundledConfigPath;
  }
}

export async function loadTenantConfig(): Promise<TenantConfig> {
  const tenantConfigPath = await resolveTenantConfigPath();
  const rawFile = await readFile(tenantConfigPath, 'utf8');

  return tenantConfigSchema.parse(JSON.parse(rawFile) as unknown);
}
