import { beforeEach, describe, expect, it } from "vitest";

import {
  purgeAppQueryCacheForConnectionBoundary,
  queryClient,
  queryClientDefaultOptions,
} from "./query-client";

describe("queryClientDefaultOptions", () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it("uses the documented Phase 0 query defaults", () => {
    expect(queryClientDefaultOptions.queries).toMatchObject({
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    });
  });

  it("applies the defaults to the shared QueryClient", () => {
    expect(queryClient.getDefaultOptions().queries).toMatchObject({
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    });
  });

  it("purges app-scoped cached query data through the shared boundary helper", () => {
    queryClient.setQueryData(["console", "exchange", "tenant-a", "groups"], {
      items: [{ id: "group-1" }],
    });
    queryClient.setQueryData(["other-app", "exchange", "tenant-a", "groups"], {
      items: [{ id: "group-2" }],
    });

    expect(queryClient.getQueryData(["console", "exchange", "tenant-a", "groups"])).toEqual({
      items: [{ id: "group-1" }],
    });
    expect(queryClient.getQueryData(["other-app", "exchange", "tenant-a", "groups"])).toEqual({
      items: [{ id: "group-2" }],
    });

    purgeAppQueryCacheForConnectionBoundary();

    expect(queryClient.getQueryData(["console", "exchange", "tenant-a", "groups"])).toBeUndefined();
    expect(queryClient.getQueryData(["other-app", "exchange", "tenant-a", "groups"])).toEqual({
      items: [{ id: "group-2" }],
    });
  });
});
