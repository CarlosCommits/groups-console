import type { ExchangeConnectionStatus } from "@/shared/contracts/exchange";
import type { GraphConnectionStatus } from "@/shared/contracts/graph";

const QUERY_NAMESPACE = "console";
const DISCONNECTED_CONNECTION_SCOPE = "disconnected";

type QueryKeyPart = string | number | boolean | null | undefined | Record<string, unknown>;

type ExchangeConnectionIdentityInput = Pick<
  ExchangeConnectionStatus,
  "state" | "tenantId" | "connectionId" | "userPrincipalName"
>;

type GraphConnectionIdentityInput = Pick<
  GraphConnectionStatus,
  "state" | "tenantId" | "configuredTenantId" | "accountUsername"
>;

export function normalizeConnectionScope(connectionIdentity?: string | null) {
  const normalized = connectionIdentity?.trim();
  return normalized && normalized.length > 0 ? normalized : DISCONNECTED_CONNECTION_SCOPE;
}

export function getExchangeConnectionIdentity(
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
) {
  return [
    exchangeConnection?.state ?? "disconnected",
    exchangeConnection?.tenantId ?? "none",
    exchangeConnection?.connectionId ?? "none",
    exchangeConnection?.userPrincipalName ?? "none",
  ].join(":");
}

export function getGraphConnectionIdentity(
  graphConnection?: GraphConnectionIdentityInput | null,
) {
  return [
    graphConnection?.state ?? "disconnected",
    graphConnection?.tenantId ?? graphConnection?.configuredTenantId ?? "none",
    graphConnection?.accountUsername ?? "none",
  ].join(":");
}

export const queryKeys = {
  all() {
    return [QUERY_NAMESPACE] as const;
  },

  scoped(service: string, connectionIdentity: string | null | undefined, ...parts: ReadonlyArray<QueryKeyPart>) {
    return [QUERY_NAMESPACE, service, normalizeConnectionScope(connectionIdentity), ...parts] as const;
  },

  exchangeRoot(connectionIdentity?: string | null) {
    return queryKeys.scoped("exchange", connectionIdentity);
  },

  exchangeGroupsRoot(connectionIdentity?: string | null) {
    return queryKeys.scoped("exchange", connectionIdentity, "groups");
  },

  exchangeGroupsList(connectionIdentity?: string | null) {
    return queryKeys.scoped("exchange", connectionIdentity, "groups", "list");
  },

  exchangeGroupMembersRoot(connectionIdentity?: string | null) {
    return queryKeys.scoped("exchange", connectionIdentity, "groups", "members");
  },

  exchangeGroupMembersList(connectionIdentity: string | null | undefined, groupExchangeIdentity: string) {
    return queryKeys.scoped(
      "exchange",
      connectionIdentity,
      "groups",
      "members",
      groupExchangeIdentity,
    );
  },

  graphRoot(connectionIdentity?: string | null) {
    return queryKeys.scoped("graph", connectionIdentity);
  },

  recipientsSearchRoot(connectionIdentity?: string | null) {
    return queryKeys.scoped("recipients", connectionIdentity, "search");
  },

  recipientsSearch(connectionIdentity: string | null | undefined, query: string, types: readonly string[]) {
    return queryKeys.scoped("recipients", connectionIdentity, "search", query, types.join(","));
  },

  contactDetails(connectionIdentity: string | null | undefined, stableKey: string) {
    return queryKeys.scoped("contacts", connectionIdentity, "details", stableKey);
  },

  guestDetails(connectionIdentity: string | null | undefined, stableKey: string) {
    return queryKeys.scoped("guests", connectionIdentity, "details", stableKey);
  },

  exchangeRecipientDetails(connectionIdentity: string | null | undefined, stableKey: string) {
    return queryKeys.scoped("exchange", connectionIdentity, "recipient-details", stableKey);
  },
};

export const queryKeyNamespace = QUERY_NAMESPACE;
export const disconnectedConnectionScope = DISCONNECTED_CONNECTION_SCOPE;
