import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { invalidateContactDetailsQuery } from "@/renderer/hooks/use-contact-details";
import { invalidateRecipientsSearchQueryForConnection } from "@/renderer/hooks/use-recipients-search";
import { getExchangeConnectionIdentity, getGraphConnectionIdentity } from "@/renderer/lib/query-keys";
import type {
  ContactsCreatePayload,
  ContactsUpdateCompanyPayload,
} from "@/shared/contracts/contacts";
import type { ExchangeConnectionStatus } from "@/shared/contracts/exchange";
import type { GraphConnectionStatus } from "@/shared/contracts/graph";

type ExchangeConnectionIdentityInput = Pick<
  ExchangeConnectionStatus,
  "state" | "tenantId" | "connectionId" | "userPrincipalName"
>;

type GraphConnectionIdentityInput = Pick<
  GraphConnectionStatus,
  "state" | "tenantId" | "configuredTenantId" | "accountUsername"
>;

export interface UpdateContactCompanyMutationVariables {
  payload: ContactsUpdateCompanyPayload;
  stableKey: string;
}

function getCombinedRecipientsConnectionIdentity(
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
  graphConnection?: GraphConnectionIdentityInput | null,
) {
  return `${getExchangeConnectionIdentity(exchangeConnection)}|${getGraphConnectionIdentity(graphConnection)}`;
}

async function invalidateContactMutationSearches(
  queryClient: QueryClient,
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
  graphConnection?: GraphConnectionIdentityInput | null,
) {
  await invalidateRecipientsSearchQueryForConnection(
    queryClient,
    getExchangeConnectionIdentity(exchangeConnection),
  );
  await invalidateRecipientsSearchQueryForConnection(
    queryClient,
    getCombinedRecipientsConnectionIdentity(exchangeConnection, graphConnection),
  );
}

export function getCreateContactMutationOptions(
  queryClient: QueryClient,
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
  graphConnection?: GraphConnectionIdentityInput | null,
) {
  return {
    mutationFn: async (payload: ContactsCreatePayload) => window.radApp.contacts.create(payload),
    onSuccess: async (result: Awaited<ReturnType<typeof window.radApp.contacts.create>>) => {
      if (result.outcome !== "created") {
        return;
      }

      await invalidateContactMutationSearches(queryClient, exchangeConnection, graphConnection);
    },
  };
}

export function useCreateContactMutation(
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
  graphConnection?: GraphConnectionIdentityInput | null,
) {
  const queryClient = useQueryClient();

  return useMutation(getCreateContactMutationOptions(queryClient, exchangeConnection, graphConnection));
}

export function getUpdateContactCompanyMutationOptions(
  queryClient: QueryClient,
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
  graphConnection?: GraphConnectionIdentityInput | null,
) {
  return {
    mutationFn: async ({ payload }: UpdateContactCompanyMutationVariables) =>
      window.radApp.contacts.updateCompany(payload),
    onSuccess: async (
      _result: Awaited<ReturnType<typeof window.radApp.contacts.updateCompany>>,
      variables: UpdateContactCompanyMutationVariables,
    ) => {
      await invalidateContactMutationSearches(queryClient, exchangeConnection, graphConnection);
      await invalidateContactDetailsQuery(queryClient, exchangeConnection, variables.stableKey);
    },
  };
}

export function useUpdateContactCompanyMutation(
  exchangeConnection?: ExchangeConnectionIdentityInput | null,
  graphConnection?: GraphConnectionIdentityInput | null,
) {
  const queryClient = useQueryClient();

  return useMutation(
    getUpdateContactCompanyMutationOptions(queryClient, exchangeConnection, graphConnection),
  );
}
