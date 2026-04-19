import { QueryClient, queryOptions, useQuery } from "@tanstack/react-query";

import {
  formatPresentedCommandFailure,
  presentCommandFailure,
  type ClassifiedFailurePresentation,
} from "@/renderer/components/console/command-failure-presenter";
import { getExchangeConnectionIdentity, queryKeys } from "@/renderer/lib/query-keys";
import type { ContactDetails, ContactsGetDetailsResult } from "@/shared/contracts/contacts";
import type { ExchangeConnectionStatus } from "@/shared/contracts/exchange";

const DETAILS_ERROR_TITLE = "Detail Error";
const DETAILS_ERROR_BODY = "Failed to load contact details.";

type ExchangeConnectionIdentityInput = Pick<
  ExchangeConnectionStatus,
  "state" | "tenantId" | "connectionId" | "userPrincipalName"
>;

export function getContactDetailsQueryOptions(
  connectionIdentity: string | null | undefined,
  stableKey: string | null | undefined,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: queryKeys.contactDetails(connectionIdentity, stableKey ?? "none"),
    enabled,
    queryFn: async (): Promise<ContactsGetDetailsResult> =>
      window.radApp.contacts.getDetails({ stableKey: stableKey! }),
  });
}

export async function invalidateContactDetailsQuery(
  queryClient: QueryClient,
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
  stableKey?: string | null,
) {
  if (!stableKey) {
    return;
  }

  const connectionIdentity = getExchangeConnectionIdentity(exchangeConnection);

  await queryClient.invalidateQueries({
    queryKey: queryKeys.contactDetails(connectionIdentity, stableKey),
  });
}

export function removeContactDetailsQuery(
  queryClient: QueryClient,
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
  stableKey?: string | null,
) {
  if (!stableKey) {
    return;
  }

  const connectionIdentity = getExchangeConnectionIdentity(exchangeConnection);

  queryClient.removeQueries({
    queryKey: queryKeys.contactDetails(connectionIdentity, stableKey),
  });
}

export interface UseContactDetailsQueryResult {
  contact: ContactDetails | null;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  errorPresentation: ClassifiedFailurePresentation | null;
  refetch: () => Promise<unknown>;
}

export function useContactDetailsQuery(
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
  stableKey?: string | null,
  enabled?: boolean,
): UseContactDetailsQueryResult {
  const exchangeConnected = exchangeConnection?.state === "connected";
  const connectionIdentity = getExchangeConnectionIdentity(exchangeConnection);
  const shouldEnable = (enabled ?? true) && exchangeConnected && !!stableKey;

  const queryResult = useQuery(
    getContactDetailsQueryOptions(connectionIdentity, stableKey, shouldEnable),
  );

  const errorPresentation = queryResult.error
    ? presentCommandFailure(queryResult.error, DETAILS_ERROR_TITLE, DETAILS_ERROR_BODY)
    : null;

  return {
    contact: queryResult.data?.contact ?? null,
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    error: errorPresentation ? formatPresentedCommandFailure(errorPresentation) : null,
    errorPresentation,
    refetch: () => queryResult.refetch(),
  };
}
