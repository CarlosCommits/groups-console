import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';

import { getRadAppTenantConfigPath } from '@/main/app/paths';
import { tenantConfigSchema, type TenantConfig } from '@/shared/contracts/graph';

export async function loadTenantConfig(): Promise<TenantConfig> {
  const tenantConfigPath = getRadAppTenantConfigPath();

  await access(tenantConfigPath, fsConstants.R_OK);
  const rawFile = await readFile(tenantConfigPath, 'utf8');

  return tenantConfigSchema.parse(JSON.parse(rawFile) as unknown);
}
