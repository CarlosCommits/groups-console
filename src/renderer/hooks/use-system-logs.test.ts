import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query";
import type * as ReactQuery from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SystemLogsListEventsResult } from "@/shared/contracts/system-logs";

const { useInfiniteQueryMock, useQueryClientMock } = vi.hoisted(() => ({
  useInfiniteQueryMock: vi.fn(),
  useQueryClientMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof ReactQuery>(
    "@tanstack/react-query",
  );

  return {
    ...actual,
    useInfiniteQuery: useInfiniteQueryMock,
    useQueryClient: useQueryClientMock,
  };
});

import {
  getSystemLogsQueryOptions,
  useSystemLogsQuery,
} from "./use-system-logs";

function makeSystemLogsResult(
  overrides: Partial<SystemLogsListEventsResult> = {},
): SystemLogsListEventsResult {
  return {
    items: [
      {
        timestamp: "2026-04-18T10:00:00.000Z",
        operationId: "operation-1",
        ipcRequestId: "request-1",
        actorUpn: "admin@example.com",
        tenantId: "tenant-a",
        operationType: "group.update",
        targetObjectType: "distributionList",
        targetObjectId: "group-1",
        summary: "Updated group settings.",
        result: "succeeded",
        authoritative: true,
      },
    ],
    nextCursor: null,
    ...overrides,
  };
}

function makeCommandFailure() {
  const err = new Error("System logs bridge timed out") as Error & {
    code: string;
    retryable: boolean;
    details: string;
    classification: {
      category: string;
      remediation: string;
      backend: string;
      operation: string;
      guidance: string;
    };
  };

  err.name = "CommandFailure";
  err.code = "system_logs_timeout";
  err.retryable = true;
  err.details = "System logs request timed out.";
  err.classification = {
    category: "connectionFailure",
    remediation: "reconnect",
    backend: "diagnostics",
    operation: "systemLogs.listEvents",
    guidance: "Reconnect to the runtime and try again.",
  };

  return err;
}

describe("useSystemLogsQuery", () => {
  beforeEach(() => {
    useInfiniteQueryMock.mockReset();
    useQueryClientMock.mockReset();
  });

  it("maps paginated query data into the shared panel-facing shape", () => {
    const resetQueries = vi.fn(() => Promise.resolve(undefined));
    const fetchNextPage = vi.fn(() => Promise.resolve(undefined));

    useQueryClientMock.mockReturnValue({
      resetQueries,
    });
    useInfiniteQueryMock.mockReturnValue({
      data: {
        pages: [
          makeSystemLogsResult(),
          makeSystemLogsResult({
            items: [
              {
                timestamp: "2026-04-18T09:00:00.000Z",
                operationId: "operation-2",
                ipcRequestId: "request-2",
                actorUpn: "admin@example.com",
                tenantId: "tenant-a",
                operationType: "group.members.add",
                targetObjectType: "distributionList",
                targetObjectId: "group-1",
                summary: "Added a member.",
                result: "partial",
                authoritative: true,
              },
            ],
            nextCursor: null,
          }),
        ],
        pageParams: [null, "cursor-1"],
      },
      error: null,
      hasNextPage: true,
      isLoading: false,
      isFetching: true,
      isFetchingNextPage: false,
      fetchNextPage,
    });

    const result = useSystemLogsQuery({ kind: "all" });

    expect(result.events).toEqual([
      ...makeSystemLogsResult().items,
      {
        timestamp: "2026-04-18T09:00:00.000Z",
        operationId: "operation-2",
        ipcRequestId: "request-2",
        actorUpn: "admin@example.com",
        tenantId: "tenant-a",
        operationType: "group.members.add",
        targetObjectType: "distributionList",
        targetObjectId: "group-1",
        summary: "Added a member.",
        result: "partial",
        authoritative: true,
      },
    ]);
    expect(result.hasNextPage).toBe(true);
    expect(result.isLoading).toBe(false);
    expect(result.isFetching).toBe(true);
    expect(result.isFetchingNextPage).toBe(false);
    expect(result.error).toBeNull();
    expect(result.errorPresentation).toBeNull();
  });

  it("formats query failures with the shared command failure presenter", () => {
    useQueryClientMock.mockReturnValue({
      resetQueries: vi.fn(() => Promise.resolve(undefined)),
    });
    useInfiniteQueryMock.mockReturnValue({
      data: undefined,
      error: makeCommandFailure(),
      hasNextPage: false,
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(() => Promise.resolve(undefined)),
    });

    const result = useSystemLogsQuery({ kind: "all" });

    expect(result.errorPresentation).toMatchObject({
      title: "Connection Failed",
      body: "System logs request timed out.",
      guidance: "Reconnect to the runtime and try again.",
      severity: "error",
      retryable: true,
    });
    expect(result.error).toBe("System logs request timed out. Reconnect to the runtime and try again.");
  });

  it("refreshes by resetting the scoped infinite query to first-page state", async () => {
    const resetQueries = vi.fn(() => Promise.resolve(undefined));

    useQueryClientMock.mockReturnValue({
      resetQueries,
    });
    useInfiniteQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      hasNextPage: false,
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(() => Promise.resolve(undefined)),
    });

    const result = useSystemLogsQuery({
      kind: "targetObject",
      targetObjectId: "group-1",
      targetObjectTypes: ["distributionList"],
    });

    await result.refresh();

    expect(resetQueries).toHaveBeenCalledWith({
      queryKey: ["console", "systemLogs", "list", "targetObject:group-1:distributionList"],
      exact: true,
    });
  });

  it("loads the next page only when a cursor is available", async () => {
    useQueryClientMock.mockReturnValue({
      resetQueries: vi.fn(() => Promise.resolve(undefined)),
    });

    const fetchNextPage = vi.fn(() => Promise.resolve(undefined));
    useInfiniteQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      hasNextPage: true,
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      fetchNextPage,
    });

    const result = useSystemLogsQuery({ kind: "all" });

    await result.loadMore();

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });
});

describe("getSystemLogsQueryOptions", () => {
  const listEventsMock = vi.fn<() => Promise<SystemLogsListEventsResult>>();

  beforeEach(() => {
    listEventsMock.mockReset();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        groupsConsole: {
          systemLogs: {
            listEvents: listEventsMock,
          },
        },
      },
    });
  });

  it("fetches the first page with the fixed page size of 25", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    listEventsMock.mockResolvedValue(makeSystemLogsResult());

    const options = getSystemLogsQueryOptions({ kind: "all" });

    await queryClient.fetchInfiniteQuery(options);

    expect(listEventsMock).toHaveBeenCalledWith({
      scope: { kind: "all" },
      pageSize: 25,
    });
  });

  it("isolates cached pages by system logs scope identity", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    const allScopeResult = makeSystemLogsResult();
    const targetScopeResult = makeSystemLogsResult({ items: [] });

    listEventsMock
      .mockResolvedValueOnce(allScopeResult)
      .mockResolvedValueOnce(targetScopeResult);

    const allScopeOptions = getSystemLogsQueryOptions({ kind: "all" });
    const targetScopeOptions = getSystemLogsQueryOptions({
      kind: "targetObject",
      targetObjectId: "group-1",
      targetObjectTypes: ["distributionList"],
    });

    await queryClient.fetchInfiniteQuery(allScopeOptions);
    await queryClient.fetchInfiniteQuery(targetScopeOptions);

    expect(listEventsMock).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryData(allScopeOptions.queryKey)).toEqual({
      pages: [allScopeResult],
      pageParams: [null],
    });
    expect(queryClient.getQueryData(targetScopeOptions.queryKey)).toEqual({
      pages: [targetScopeResult],
      pageParams: [null],
    });
  });

  it("uses the previous next cursor for the next-page request", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    listEventsMock
      .mockResolvedValueOnce(makeSystemLogsResult({ nextCursor: "cursor-1" }))
      .mockResolvedValueOnce(makeSystemLogsResult({ items: [], nextCursor: null }));

    const observer = new InfiniteQueryObserver(queryClient, getSystemLogsQueryOptions({ kind: "all" }));
    const unsubscribe = observer.subscribe(() => undefined);

    await observer.refetch();
    await observer.fetchNextPage();

    unsubscribe();

    expect(listEventsMock).toHaveBeenNthCalledWith(2, {
      scope: { kind: "all" },
      cursor: "cursor-1",
      pageSize: 25,
    });
    expect(observer.getCurrentResult().data?.pages).toHaveLength(2);
  });

  it("resets active pagination back to the first page on refresh", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    listEventsMock
      .mockResolvedValueOnce(makeSystemLogsResult({ nextCursor: "cursor-1" }))
      .mockResolvedValueOnce(makeSystemLogsResult({ items: [], nextCursor: null }))
      .mockResolvedValueOnce(makeSystemLogsResult({ nextCursor: null }));

    const options = getSystemLogsQueryOptions({ kind: "all" });
    const observer = new InfiniteQueryObserver(queryClient, options);
    const unsubscribe = observer.subscribe(() => undefined);

    await observer.refetch();
    await observer.fetchNextPage();
    await queryClient.resetQueries({ queryKey: options.queryKey, exact: true });

    unsubscribe();

    expect(listEventsMock).toHaveBeenNthCalledWith(3, {
      scope: { kind: "all" },
      pageSize: 25,
    });
    expect(observer.getCurrentResult().data?.pages).toHaveLength(1);
  });
});
