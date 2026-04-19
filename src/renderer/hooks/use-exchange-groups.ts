import { QueryClient, queryOptions, useQuery } from "@tanstack/react-query";

import {
  formatPresentedCommandFailure,
  presentCommandFailure,
  type ClassifiedFailurePresentation,
} from "@/renderer/components/console/command-failure-presenter";
import { getExchangeConnectionIdentity, queryKeys } from "@/renderer/lib/query-keys";
import type {
  ExchangeConnectionStatus,
  ExchangeGroupListItem,
  ExchangeListGroupsResult,
} from "@/shared/contracts/exchange";

const GROUPS_ERROR_TITLE = "Groups Error";
const GROUPS_ERROR_BODY = "Failed to load groups.";

type ExchangeConnectionIdentityInput = Pick<
  ExchangeConnectionStatus,
  "state" | "tenantId" | "connectionId" | "userPrincipalName"
>;

export function getExchangeGroupsQueryOptions(
  connectionIdentity: string | null | undefined,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: queryKeys.exchangeGroupsList(connectionIdentity),
    enabled,
    queryFn: async (): Promise<ExchangeListGroupsResult> => window.radApp.exchange.listGroups(),
  });
}

export async function invalidateExchangeGroupsQueryForConnection(
  queryClient: QueryClient,
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
) {
  const connectionIdentity = getExchangeConnectionIdentity(exchangeConnection);

  await queryClient.invalidateQueries({
    queryKey: queryKeys.exchangeGroupsRoot(connectionIdentity),
  });
}

export interface UseExchangeGroupsQueryResult {
  groups: ExchangeGroupListItem[];
  appliedKind: ExchangeListGroupsResult["appliedKind"] | null;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  errorPresentation: ClassifiedFailurePresentation | null;
  refetch: () => Promise<unknown>;
}

export function useExchangeGroupsQuery(
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
): UseExchangeGroupsQueryResult {
  const exchangeConnected = exchangeConnection?.state === "connected";
  const connectionIdentity = getExchangeConnectionIdentity(exchangeConnection);

  const query = useQuery(getExchangeGroupsQueryOptions(connectionIdentity, exchangeConnected));

  const errorPresentation = query.error
    ? presentCommandFailure(query.error, GROUPS_ERROR_TITLE, GROUPS_ERROR_BODY)
    : null;

  return {
    groups: query.data?.items ?? [],
    appliedKind: query.data?.appliedKind ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: errorPresentation ? formatPresentedCommandFailure(errorPresentation) : null,
    errorPresentation,
    refetch: () => query.refetch(),
  };
}
