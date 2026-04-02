import { shell } from 'electron';
import {
  PublicClientApplication,
  type AccountInfo,
  type AuthenticationResult,
  type IPublicClientApplication,
} from '@azure/msal-node';

import type { TenantConfig } from '@/shared/contracts/graph';

const DEFAULT_GRAPH_SCOPES = [
  'User.Read',
  'User.Read.All',
  'User.ReadWrite.All',
  'User.Invite.All',
];

export function createGraphPublicClient(
  config: TenantConfig,
): IPublicClientApplication {
  return new PublicClientApplication({
    auth: {
      clientId: config.graph.clientId,
      authority: `${config.graph.authorityHost ?? 'https://login.microsoftonline.com'}/${config.tenantId}`,
    },
  });
}

export function getGraphScopes(config: TenantConfig): string[] {
  return config.graph.scopes ?? DEFAULT_GRAPH_SCOPES;
}

export async function acquireInteractiveGraphToken(
  publicClient: IPublicClientApplication,
  config: TenantConfig,
): Promise<AuthenticationResult> {
  return await publicClient.acquireTokenInteractive({
    scopes: getGraphScopes(config),
    redirectUri: config.graph.redirectUri,
    openBrowser: async (url: string) => {
      await shell.openExternal(url);
    },
    successTemplate: 'Authentication complete. You can return to RAD App.',
    errorTemplate: 'Authentication failed. You can close this window and return to RAD App.',
  });
}

export async function acquireSilentGraphToken(
  publicClient: IPublicClientApplication,
  config: TenantConfig,
  account: AccountInfo,
): Promise<AuthenticationResult> {
  return await publicClient.acquireTokenSilent({
    account,
    scopes: getGraphScopes(config),
    forceRefresh: false,
  });
}

export async function signOutGraphAccount(
  publicClient: IPublicClientApplication,
  account: AccountInfo,
): Promise<void> {
  await publicClient.signOut({ account });
}
