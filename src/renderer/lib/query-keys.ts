const QUERY_NAMESPACE = "console";
const DISCONNECTED_CONNECTION_SCOPE = "disconnected";

type QueryKeyPart = string | number | boolean | null | undefined | Record<string, unknown>;

export function normalizeConnectionScope(connectionIdentity?: string | null) {
  const normalized = connectionIdentity?.trim();
  return normalized && normalized.length > 0 ? normalized : DISCONNECTED_CONNECTION_SCOPE;
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

  graphRoot(connectionIdentity?: string | null) {
    return queryKeys.scoped("graph", connectionIdentity);
  },
};

export const queryKeyNamespace = QUERY_NAMESPACE;
export const disconnectedConnectionScope = DISCONNECTED_CONNECTION_SCOPE;
