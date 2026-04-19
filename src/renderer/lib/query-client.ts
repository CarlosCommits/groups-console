import { QueryClient, type DefaultOptions } from "@tanstack/react-query";

import { queryKeys } from "./query-keys";

export const queryClientDefaultOptions: DefaultOptions = {
  queries: {
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  },
};

export const queryClient = new QueryClient({
  defaultOptions: queryClientDefaultOptions,
});

export function purgeAppQueryCacheForConnectionBoundary() {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: queryKeys.all() })) {
    queryClient.getQueryCache().remove(query);
  }
}
