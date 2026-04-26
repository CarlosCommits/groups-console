import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  formatPresentedCommandFailure,
  presentCommandFailure,
  type ClassifiedFailurePresentation,
} from "@/renderer/components/console/command-failure-presenter";
import { getSystemLogScopeKey, queryKeys } from "@/renderer/lib/query-keys";
import type {
  SystemLogEventItem,
  SystemLogScope,
  SystemLogsListEventsResult,
} from "@/shared/contracts/system-logs";

const SYSTEM_LOGS_ERROR_TITLE = "System Logs Error";
const SYSTEM_LOGS_ERROR_BODY = "Failed to load system logs.";
const SYSTEM_LOGS_PAGE_SIZE = 25;

type SystemLogsPageParam = string | null;

export function getSystemLogsQueryOptions(scope: SystemLogScope) {
  return infiniteQueryOptions({
    queryKey: queryKeys.systemLogsList(getSystemLogScopeKey(scope)),
    initialPageParam: null as SystemLogsPageParam,
    queryFn: async ({ pageParam }): Promise<SystemLogsListEventsResult> =>
      window.groupsConsole.systemLogs.listEvents({
        scope,
        ...(pageParam ? { cursor: pageParam } : {}),
        pageSize: SYSTEM_LOGS_PAGE_SIZE,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export interface UseSystemLogsQueryResult {
  events: SystemLogEventItem[];
  hasNextPage: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  error: string | null;
  errorPresentation: ClassifiedFailurePresentation | null;
  loadMore: () => Promise<unknown>;
  refresh: () => Promise<void>;
}

export function useSystemLogsQuery(scope: SystemLogScope): UseSystemLogsQueryResult {
  const queryClient = useQueryClient();
  const options = getSystemLogsQueryOptions(scope);
  const query = useInfiniteQuery(options);

  const errorPresentation = query.error
    ? presentCommandFailure(query.error, SYSTEM_LOGS_ERROR_TITLE, SYSTEM_LOGS_ERROR_BODY)
    : null;

  return {
    events: query.data?.pages.flatMap((page) => page.items) ?? [],
    hasNextPage: query.hasNextPage ?? false,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    error: errorPresentation ? formatPresentedCommandFailure(errorPresentation) : null,
    errorPresentation,
    loadMore: async () => {
      if (!query.hasNextPage || query.isFetchingNextPage) {
        return undefined;
      }

      return query.fetchNextPage();
    },
    refresh: async () => {
      await queryClient.resetQueries({
        queryKey: options.queryKey,
        exact: true,
      });
    },
  };
}

export { getSystemLogScopeKey };
