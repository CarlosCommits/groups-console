import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { invalidateGuestDetailsQuery } from "@/renderer/hooks/use-guest-details";
import { invalidateRecipientsSearchQueryForConnection } from "@/renderer/hooks/use-recipients-search";
import { getExchangeConnectionIdentity, getGraphConnectionIdentity } from "@/renderer/lib/query-keys";
import type { ExchangeConnectionStatus } from "@/shared/contracts/exchange";
import type { GraphConnectionStatus } from "@/shared/contracts/graph";
import type { GuestsInvitePayload, GuestsUpdateCompanyPayload } from "@/shared/contracts/guests";

type ExchangeConnectionIdentityInput = Pick<
  ExchangeConnectionStatus,
  "state" | "tenantId" | "connectionId" | "userPrincipalName"
>;

type GraphConnectionIdentityInput = Pick<
  GraphConnectionStatus,
  "state" | "tenantId" | "configuredTenantId" | "accountUsername"
>;

export interface UpdateGuestCompanyMutationVariables {
  payload: GuestsUpdateCompanyPayload;
  stableKey: string;
}

function getCombinedRecipientsConnectionIdentity(
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
  graphConnection?: GraphConnectionIdentityInput | null,
) {
  return `${getExchangeConnectionIdentity(exchangeConnection)}|${getGraphConnectionIdentity(graphConnection)}`;
}

async function invalidateGuestMutationSearches(
  queryClient: QueryClient,
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
  graphConnection?: GraphConnectionIdentityInput | null,
) {
  await invalidateRecipientsSearchQueryForConnection(queryClient, getGraphConnectionIdentity(graphConnection));
  await invalidateRecipientsSearchQueryForConnection(
    queryClient,
    getCombinedRecipientsConnectionIdentity(exchangeConnection, graphConnection),
  );
}

export function getInviteGuestMutationOptions(
  queryClient: QueryClient,
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
  graphConnection?: GraphConnectionIdentityInput | null,
) {
  return {
    mutationFn: async (payload: GuestsInvitePayload) => window.radApp.guests.invite(payload),
    onSuccess: async (result: Awaited<ReturnType<typeof window.radApp.guests.invite>>) => {
      if (result.outcome !== "invited") {
        return;
      }

      await invalidateGuestMutationSearches(queryClient, exchangeConnection, graphConnection);
    },
  };
}

export function useInviteGuestMutation(
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
  graphConnection?: GraphConnectionIdentityInput | null,
) {
  const queryClient = useQueryClient();

  return useMutation(getInviteGuestMutationOptions(queryClient, exchangeConnection, graphConnection));
}

export function getUpdateGuestCompanyMutationOptions(
  queryClient: QueryClient,
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
  graphConnection?: GraphConnectionIdentityInput | null,
) {
  return {
    mutationFn: async ({ payload }: UpdateGuestCompanyMutationVariables) =>
      window.radApp.guests.updateCompany(payload),
    onSuccess: async (
      _result: Awaited<ReturnType<typeof window.radApp.guests.updateCompany>>,
      variables: UpdateGuestCompanyMutationVariables,
    ) => {
      await invalidateGuestMutationSearches(queryClient, exchangeConnection, graphConnection);
      await invalidateGuestDetailsQuery(queryClient, graphConnection, variables.stableKey);
    },
  };
}

export function useUpdateGuestCompanyMutation(
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
  graphConnection?: GraphConnectionIdentityInput | null,
) {
  const queryClient = useQueryClient();

  return useMutation(getUpdateGuestCompanyMutationOptions(queryClient, exchangeConnection, graphConnection));
}
