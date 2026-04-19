import { QueryClient, queryOptions, useQuery } from "@tanstack/react-query";

import {
  formatPresentedCommandFailure,
  presentCommandFailure,
  type ClassifiedFailurePresentation,
} from "@/renderer/components/console/command-failure-presenter";
import { getGraphConnectionIdentity, queryKeys } from "@/renderer/lib/query-keys";
import type { GuestDetails, GuestsGetDetailsResult } from "@/shared/contracts/guests";
import type { GraphConnectionStatus } from "@/shared/contracts/graph";

const DETAILS_ERROR_TITLE = "Detail Error";
const DETAILS_ERROR_BODY = "Failed to load guest details.";

type GraphConnectionIdentityInput = Pick<
  GraphConnectionStatus,
  "state" | "tenantId" | "configuredTenantId" | "accountUsername"
>;

export function getGuestDetailsQueryOptions(
  connectionIdentity: string | null | undefined,
  stableKey: string | null | undefined,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: queryKeys.guestDetails(connectionIdentity, stableKey ?? "none"),
    enabled,
    queryFn: async (): Promise<GuestsGetDetailsResult> =>
      window.radApp.guests.getDetails({ stableKey: stableKey! }),
  });
}

export async function invalidateGuestDetailsQuery(
  queryClient: QueryClient,
  graphConnection?: GraphConnectionIdentityInput | null,
  stableKey?: string | null,
) {
  if (!stableKey) {
    return;
  }

  const connectionIdentity = getGraphConnectionIdentity(graphConnection);

  await queryClient.invalidateQueries({
    queryKey: queryKeys.guestDetails(connectionIdentity, stableKey),
  });
}

export function removeGuestDetailsQuery(
  queryClient: QueryClient,
  graphConnection?: GraphConnectionIdentityInput | null,
  stableKey?: string | null,
) {
  if (!stableKey) {
    return;
  }

  const connectionIdentity = getGraphConnectionIdentity(graphConnection);

  queryClient.removeQueries({
    queryKey: queryKeys.guestDetails(connectionIdentity, stableKey),
  });
}

export interface UseGuestDetailsQueryResult {
  guest: GuestDetails | null;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  errorPresentation: ClassifiedFailurePresentation | null;
  refetch: () => Promise<unknown>;
}

export function useGuestDetailsQuery(
  graphConnection?: GraphConnectionIdentityInput | null,
  stableKey?: string | null,
  enabled?: boolean,
): UseGuestDetailsQueryResult {
  const graphConnected = graphConnection?.state === "connected";
  const connectionIdentity = getGraphConnectionIdentity(graphConnection);
  const shouldEnable = (enabled ?? true) && graphConnected && !!stableKey;

  const queryResult = useQuery(
    getGuestDetailsQueryOptions(connectionIdentity, stableKey, shouldEnable),
  );

  const errorPresentation = queryResult.error
    ? presentCommandFailure(queryResult.error, DETAILS_ERROR_TITLE, DETAILS_ERROR_BODY)
    : null;

  return {
    guest: queryResult.data?.guest ?? null,
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    error: errorPresentation ? formatPresentedCommandFailure(errorPresentation) : null,
    errorPresentation,
    refetch: () => queryResult.refetch(),
  };
}
