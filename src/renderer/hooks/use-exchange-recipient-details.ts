import { QueryClient, queryOptions, useQuery } from "@tanstack/react-query";

import {
  formatPresentedCommandFailure,
  presentCommandFailure,
  type ClassifiedFailurePresentation,
} from "@/renderer/components/console/command-failure-presenter";
import { getExchangeConnectionIdentity, queryKeys } from "@/renderer/lib/query-keys";
import type { ExchangeRecipientDetails, ExchangeRecipientGetDetailsResult } from "@/shared/contracts/exchange";
import type { ExchangeConnectionStatus } from "@/shared/contracts/exchange";

const DETAILS_ERROR_TITLE = "Detail Error";
const DETAILS_ERROR_BODY = "Failed to load recipient details.";

type ExchangeConnectionIdentityInput = Pick<
  ExchangeConnectionStatus,
  "state" | "tenantId" | "connectionId" | "userPrincipalName"
>;

export function getExchangeRecipientDetailsQueryOptions(
  connectionIdentity: string | null | undefined,
  stableKey: string | null | undefined,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: queryKeys.exchangeRecipientDetails(connectionIdentity, stableKey ?? "none"),
    enabled,
    queryFn: async (): Promise<ExchangeRecipientGetDetailsResult> =>
      window.radApp.exchange.getRecipientDetails({ stableKey: stableKey! }),
  });
}

export async function invalidateExchangeRecipientDetailsQuery(
  queryClient: QueryClient,
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
  stableKey?: string | null,
) {
  if (!stableKey) {
    return;
  }

  const connectionIdentity = getExchangeConnectionIdentity(exchangeConnection);

  await queryClient.invalidateQueries({
    queryKey: queryKeys.exchangeRecipientDetails(connectionIdentity, stableKey),
  });
}

export function removeExchangeRecipientDetailsQuery(
  queryClient: QueryClient,
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
  stableKey?: string | null,
) {
  if (!stableKey) {
    return;
  }

  const connectionIdentity = getExchangeConnectionIdentity(exchangeConnection);

  queryClient.removeQueries({
    queryKey: queryKeys.exchangeRecipientDetails(connectionIdentity, stableKey),
  });
}

export interface UseExchangeRecipientDetailsQueryResult {
  recipient: ExchangeRecipientDetails | null;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  errorPresentation: ClassifiedFailurePresentation | null;
  refetch: () => Promise<unknown>;
}

export function useExchangeRecipientDetailsQuery(
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
  stableKey?: string | null,
  enabled?: boolean,
): UseExchangeRecipientDetailsQueryResult {
  const exchangeConnected = exchangeConnection?.state === "connected";
  const connectionIdentity = getExchangeConnectionIdentity(exchangeConnection);
  const shouldEnable = (enabled ?? true) && exchangeConnected && !!stableKey;

  const queryResult = useQuery(
    getExchangeRecipientDetailsQueryOptions(connectionIdentity, stableKey, shouldEnable),
  );

  const errorPresentation = queryResult.error
    ? presentCommandFailure(queryResult.error, DETAILS_ERROR_TITLE, DETAILS_ERROR_BODY)
    : null;

  return {
    recipient: queryResult.data?.recipient ?? null,
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    error: errorPresentation ? formatPresentedCommandFailure(errorPresentation) : null,
    errorPresentation,
    refetch: () => queryResult.refetch(),
  };
}
