import { constants as fsConstants } from 'node:fs';
import { access, mkdir, readFile } from 'node:fs/promises';

import { getRadAppLogDirectory, getRadAppTenantConfigPath } from '@/main/app/paths';
import type { BootstrapCheck } from '@/shared/dto/session-status';

export type LocalBootstrapCheck = Pick<BootstrapCheck, 'status' | 'detail'>;

export async function checkLogDirectoryReadiness(
  logDirectory = getRadAppLogDirectory(),
): Promise<LocalBootstrapCheck> {
  try {
    await mkdir(logDirectory, { recursive: true });
    await access(logDirectory, fsConstants.W_OK);

    return {
      status: 'ready',
      detail: `Log directory is writable at ${logDirectory}.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown filesystem error.';

    return {
      status: 'missing',
      detail: `Log directory is not writable at ${logDirectory}: ${message}`,
    };
  }
}

export async function checkTenantConfigPresence(
  tenantConfigPath = getRadAppTenantConfigPath(),
): Promise<LocalBootstrapCheck> {
  try {
    await access(tenantConfigPath, fsConstants.R_OK);
    const fileContents = await readFile(tenantConfigPath, 'utf8');

    if (!fileContents.trim()) {
      return {
        status: 'warning',
        detail: `Tenant configuration exists at ${tenantConfigPath} but is empty.`,
      };
    }

    JSON.parse(fileContents);

    return {
      status: 'ready',
      detail: `Tenant configuration is readable at ${tenantConfigPath}.`,
    };
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return {
        status: 'missing',
        detail: `Tenant configuration was not found at ${tenantConfigPath}.`,
      };
    }

    const message = error instanceof Error ? error.message : 'Unknown configuration error.';

    return {
      status: 'warning',
      detail: `Tenant configuration could not be read from ${tenantConfigPath}: ${message}`,
    };
  }
}
