import { QueryClient, queryOptions, useQuery } from "@tanstack/react-query";

import {
  formatPresentedCommandFailure,
  presentCommandFailure,
  type ClassifiedFailurePresentation,
} from "@/renderer/components/console/command-failure-presenter";
import { queryKeys } from "@/renderer/lib/query-keys";
import type {
  RecipientsSearchResult,
  RecipientSearchType,
} from "@/shared/contracts/recipients";
const SEARCH_ERROR_TITLE = "Search Error";
const SEARCH_ERROR_BODY = "Search failed.";

export function getRecipientsSearchQueryOptions(
  connectionIdentity: string | null | undefined,
  query: string,
  types: RecipientSearchType[],
  enabled: boolean,
) {
  return queryOptions({
    queryKey: queryKeys.recipientsSearch(connectionIdentity, query, types),
    enabled,
    queryFn: async (): Promise<RecipientsSearchResult> =>
      window.radApp.recipients.search({ query, types }),
  });
}

export async function invalidateRecipientsSearchQueryForConnection(
  queryClient: QueryClient,
  connectionIdentity: string | null | undefined,
) {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.recipientsSearchRoot(connectionIdentity),
  });
}

export interface UseRecipientsSearchQueryResult {
  results: RecipientsSearchResult | null;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  errorPresentation: ClassifiedFailurePresentation | null;
  refetch: () => Promise<unknown>;
}

export function useRecipientsSearchQuery(
  connectionIdentity: string | null | undefined,
  query?: string | null,
  types?: RecipientSearchType[],
  enabled = true,
): UseRecipientsSearchQueryResult {
  const trimmedQuery = (query ?? "").trim();
  const shouldEnable = enabled && trimmedQuery.length >= 2 && (types?.length ?? 0) > 0;

  const searchTypes = types ?? [];

  const queryResult = useQuery(
    getRecipientsSearchQueryOptions(connectionIdentity, trimmedQuery, searchTypes, shouldEnable),
  );

  const errorPresentation = queryResult.error
    ? presentCommandFailure(queryResult.error, SEARCH_ERROR_TITLE, SEARCH_ERROR_BODY)
    : null;

  return {
    results: queryResult.data ?? null,
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    error: errorPresentation ? formatPresentedCommandFailure(errorPresentation) : null,
    errorPresentation,
    refetch: () => queryResult.refetch(),
  };
}
