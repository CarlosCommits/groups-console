import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { safeStorage } from 'electron';
import type { AccountInfo, ICachePlugin, IPublicClientApplication, TokenCacheContext } from '@azure/msal-node';

import {
  getGroupsConsoleAuthDirectory,
  getGroupsConsoleGraphAccountPath,
  getGroupsConsoleGraphCachePath,
} from '@/main/app/paths';

type PreferredGraphAccount = {
  homeAccountId: string | null;
  username: string | null;
};

function canPersistSecurely(): boolean {
  return safeStorage.isEncryptionAvailable();
}

async function ensureAuthDirectory(): Promise<void> {
  await mkdir(getGroupsConsoleAuthDirectory(), { recursive: true });
}

async function readEncryptedText(filePath: string): Promise<string | null> {
  if (!canPersistSecurely()) {
    return null;
  }

  try {
    const encrypted = await readFile(filePath);
    return safeStorage.decryptString(encrypted);
  } catch {
    return null;
  }
}

async function writeEncryptedText(filePath: string, value: string): Promise<void> {
  if (!canPersistSecurely()) {
    return;
  }

  await ensureAuthDirectory();
  await writeFile(filePath, safeStorage.encryptString(value));
}

async function deleteFileIfPresent(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // Missing or inaccessible cache files should not block auth recovery.
  }
}

export function createElectronMsalCachePlugin(): ICachePlugin | undefined {
  if (!canPersistSecurely()) {
    return undefined;
  }

  return {
    async beforeCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
      const cache = await readEncryptedText(getGroupsConsoleGraphCachePath());
      if (cache) {
        cacheContext.tokenCache.deserialize(cache);
      }
    },
    async afterCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
      if (cacheContext.cacheHasChanged) {
        await writeEncryptedText(
          getGroupsConsoleGraphCachePath(),
          cacheContext.tokenCache.serialize(),
        );
      }
    },
  };
}

export async function rememberGraphAccount(account: AccountInfo): Promise<void> {
  const preferredAccount: PreferredGraphAccount = {
    homeAccountId: account.homeAccountId ?? null,
    username: account.username ?? null,
  };

  await writeEncryptedText(
    getGroupsConsoleGraphAccountPath(),
    JSON.stringify(preferredAccount),
  );
}

export async function forgetGraphAccount(): Promise<void> {
  await Promise.all([
    deleteFileIfPresent(getGroupsConsoleGraphAccountPath()),
    deleteFileIfPresent(getGroupsConsoleGraphCachePath()),
  ]);
}

export async function getPreferredGraphAccount(
  publicClient: IPublicClientApplication,
): Promise<AccountInfo | null> {
  const accounts = await publicClient.getAllAccounts();
  if (accounts.length === 0) {
    return null;
  }

  const rawPreference = await readEncryptedText(getGroupsConsoleGraphAccountPath());
  if (!rawPreference) {
    return accounts[0] ?? null;
  }

  let preference: PreferredGraphAccount;
  try {
    preference = JSON.parse(rawPreference) as PreferredGraphAccount;
  } catch {
    return accounts[0] ?? null;
  }

  return (
    accounts.find((account) =>
      (preference.homeAccountId && account.homeAccountId === preference.homeAccountId) ||
      (preference.username && account.username === preference.username),
    ) ??
    accounts[0] ??
    null
  );
}
