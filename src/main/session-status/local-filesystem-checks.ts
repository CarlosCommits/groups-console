import { constants as fsConstants } from 'node:fs';
import { access, mkdir, readFile } from 'node:fs/promises';

import {
  getGroupsConsoleBundledTenantConfigPath,
  getGroupsConsoleLogDirectory,
  getGroupsConsoleTenantConfigPath,
} from '@/main/app/paths';
import { tenantConfigSchema } from '@/shared/contracts/graph';
import type { BootstrapCheck } from '@/shared/dto/session-status';

export type LocalBootstrapCheck = Pick<BootstrapCheck, 'status' | 'detail'>;

export async function checkLogDirectoryReadiness(
  logDirectory = getGroupsConsoleLogDirectory(),
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
  tenantConfigPath = getGroupsConsoleTenantConfigPath(),
): Promise<LocalBootstrapCheck> {
  const candidatePaths = [tenantConfigPath];

  const bundledTenantConfigPath = getGroupsConsoleBundledTenantConfigPath();
  if (bundledTenantConfigPath !== tenantConfigPath) {
    candidatePaths.push(bundledTenantConfigPath);
  }

  let firstMissingPath: string | null = null;

  for (const candidatePath of candidatePaths) {
    try {
      await access(candidatePath, fsConstants.R_OK);
      const fileContents = await readFile(candidatePath, 'utf8');

      if (!fileContents.trim()) {
        return {
          status: 'warning',
          detail: `Tenant configuration exists at ${candidatePath} but is empty.`,
        };
      }

      const parsedConfig = tenantConfigSchema.safeParse(JSON.parse(fileContents) as unknown);
      if (!parsedConfig.success) {
        return {
          status: 'warning',
          detail: `Tenant configuration at ${candidatePath} is invalid: ${parsedConfig.error.issues[0]?.message ?? 'Unknown validation error.'}`,
        };
      }

      return {
        status: 'ready',
        detail: `Tenant configuration is readable at ${candidatePath}.`,
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        firstMissingPath ??= candidatePath;
        continue;
      }

      const message = error instanceof Error ? error.message : 'Unknown configuration error.';

      return {
        status: 'warning',
        detail: `Tenant configuration could not be read from ${candidatePath}: ${message}`,
      };
    }
  }

  if (firstMissingPath) {
    return {
      status: 'missing',
      detail: `Tenant configuration was not found at ${firstMissingPath}.`,
    };
  }

  return {
    status: 'warning',
    detail: 'Tenant configuration could not be resolved.',
  };
}
