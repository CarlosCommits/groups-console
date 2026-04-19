import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SystemLogEventItem, SystemLogScope } from "@/shared/contracts/system-logs";

interface CapturedButtonProps {
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  size?: string;
  variant?: string;
}

interface ActionButtonProps extends CapturedButtonProps {
  onClick: () => void;
}

const { useSystemLogsQueryMock, buttonPropsMock } = vi.hoisted(() => ({
  useSystemLogsQueryMock: vi.fn(),
  buttonPropsMock: vi.fn(),
}));

vi.mock("@/renderer/hooks/use-system-logs", () => ({
  useSystemLogsQuery: useSystemLogsQueryMock,
}));

vi.mock("@/renderer/components/ui/button", () => ({
  Button: ({ children, ...props }: React.PropsWithChildren<CapturedButtonProps>) => {
    buttonPropsMock({ children, ...props });
    return React.createElement("button", { type: "button", ...props }, children);
  },
}));

vi.mock("@/renderer/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => React.createElement("span", null, children),
}));

vi.mock("@/renderer/components/ui/card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("section", { className }, children),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("div", { className }, children),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("div", { className }, children),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("h2", { className }, children),
}));

vi.mock("@/renderer/components/ui/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => React.createElement("table", null, children),
  TableBody: ({ children }: { children: React.ReactNode }) => React.createElement("tbody", null, children),
  TableCell: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("td", { className }, children),
  TableHead: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("th", { className }, children),
  TableHeader: ({ children }: { children: React.ReactNode }) => React.createElement("thead", null, children),
  TableRow: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("tr", { className }, children),
}));

import { SystemLogsPanel } from "./system-logs-panel";

const ALL_SCOPE = { kind: "all" } as const;

function makeEvent(overrides: Partial<SystemLogEventItem> = {}): SystemLogEventItem {
  return {
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
    ...overrides,
  };
}

function flattenText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((child) => flattenText(child)).join("");
  }

  if (React.isValidElement(node)) {
    return flattenText((node.props as { children?: React.ReactNode }).children);
  }

  return "";
}

function getButtonProps(label: string) {
  const buttonProps = buttonPropsMock.mock.calls
    .map(([props]) => props as CapturedButtonProps)
    .find((props) => flattenText(props.children).includes(label));

  if (!buttonProps) {
    throw new Error(`Could not find button with label: ${label}`);
  }

  if (!buttonProps.onClick) {
    throw new Error(`Button with label ${label} does not have an onClick handler.`);
  }

  return buttonProps as ActionButtonProps;
}

function renderPanel(scope: SystemLogScope = ALL_SCOPE) {
  return renderToStaticMarkup(React.createElement(SystemLogsPanel, { scope }));
}

describe("SystemLogsPanel", () => {
  beforeEach(() => {
    useSystemLogsQueryMock.mockReset();
    buttonPropsMock.mockReset();

    useSystemLogsQueryMock.mockReturnValue({
      events: [],
      hasNextPage: false,
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      error: null,
      errorPresentation: null,
      loadMore: vi.fn(async () => undefined),
      refresh: vi.fn(async () => undefined),
    });
  });

  it("renders the initial loading branch while the first page is pending", () => {
    useSystemLogsQueryMock.mockReturnValue({
      events: [],
      hasNextPage: false,
      isLoading: true,
      isFetching: true,
      isFetchingNextPage: false,
      error: null,
      errorPresentation: null,
      loadMore: vi.fn(async () => undefined),
      refresh: vi.fn(async () => undefined),
    });

    const markup = renderPanel();

    expect(markup).toContain("Loading system logs…");
  });

  it("renders the panel-level error branch and retries through refresh", () => {
    const refresh = vi.fn(async () => undefined);
    useSystemLogsQueryMock.mockReturnValue({
      events: [],
      hasNextPage: false,
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      error: "System logs request timed out.",
      errorPresentation: null,
      loadMore: vi.fn(async () => undefined),
      refresh,
    });

    const markup = renderPanel();
    const retryButton = getButtonProps("Retry");

    expect(markup).toContain("Failed to load system logs");
    expect(markup).toContain("System logs request timed out.");

    void retryButton.onClick();

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("preserves the all-scope empty-state copy", () => {
    const markup = renderPanel();

    expect(markup).toContain("No system logs");
    expect(markup).toContain("System logs will appear here as operations are performed.");
  });

  it("preserves the target-object empty-state copy", () => {
    const markup = renderPanel({
      kind: "targetObject",
      targetObjectId: "group-1",
      targetObjectTypes: ["distributionList"],
    });

    expect(markup).toContain("No system logs found for this group.");
  });

  it("renders events and wires refresh and load-more actions through the shared hook", () => {
    const refresh = vi.fn(async () => undefined);
    const loadMore = vi.fn(async () => undefined);

    useSystemLogsQueryMock.mockReturnValue({
      events: [makeEvent()],
      hasNextPage: true,
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      error: null,
      errorPresentation: null,
      loadMore,
      refresh,
    });

    const markup = renderPanel();
    const refreshButton = getButtonProps("Refresh");
    const loadMoreButton = getButtonProps("Load more");

    expect(markup).toContain("System Logs");
    expect(markup).toContain("Updated group settings.");
    expect(markup).toContain("group.update");
    expect(markup).toContain("succeeded");

    void refreshButton.onClick();
    void loadMoreButton.onClick();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(loadMore).toHaveBeenCalledTimes(1);
    expect(loadMoreButton.disabled).toBe(false);
  });

  it("keeps the load-more button disabled during next-page fetches", () => {
    useSystemLogsQueryMock.mockReturnValue({
      events: [makeEvent()],
      hasNextPage: true,
      isLoading: false,
      isFetching: true,
      isFetchingNextPage: true,
      error: null,
      errorPresentation: null,
      loadMore: vi.fn(async () => undefined),
      refresh: vi.fn(async () => undefined),
    });

    renderPanel();

    expect(getButtonProps("Load more").disabled).toBe(true);
  });
});
