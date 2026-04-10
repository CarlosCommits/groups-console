import type { ShellState } from "./app-context";

export type AttentionSeverity = "error" | "warning" | "info";

export interface AttentionItem {
  id: string;
  severity: AttentionSeverity;
  title: string;
  description: string;
}

export function deriveAttentionItems(shell: ShellState): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (shell.loadError) {
    items.push({
      id: "load-error",
      severity: "error",
      title: "Shell state failed to load",
      description: shell.loadError,
    });
  }

  const graph = shell.graphConnection;
  if (graph?.state === "error") {
    items.push({
      id: "graph-error",
      severity: "error",
      title: "Graph connection error",
      description: graph.detail,
    });
  } else if (graph?.state === "disconnected") {
    items.push({
      id: "graph-disconnected",
      severity: "info",
      title: "Graph not connected",
      description: "Microsoft Graph is not connected. Some features may be limited.",
    });
  }

  if (graph?.exchangeAlignment === "mismatched") {
    items.push({
      id: "graph-tenant-mismatch",
      severity: "warning",
      title: "Tenant mismatch",
      description: "Graph and Exchange are connected to different tenants.",
    });
  }

  const exchange = shell.exchangeConnection;
  if (exchange?.state === "error") {
    items.push({
      id: "exchange-error",
      severity: "error",
      title: "Exchange connection error",
      description: exchange.detail,
    });
  } else if (exchange?.state === "disconnected") {
    items.push({
      id: "exchange-disconnected",
      severity: "info",
      title: "Exchange not connected",
      description: "Connect to Exchange Online to manage groups.",
    });
  }

  if (shell.session?.checks) {
    for (const check of shell.session.checks) {
      if (check.status === "missing") {
        items.push({
          id: `check-missing-${check.id}`,
          severity: "warning",
          title: `${check.label} missing`,
          description: check.detail,
        });
      } else if (check.status === "warning") {
        items.push({
          id: `check-warning-${check.id}`,
          severity: "warning",
          title: `${check.label} warning`,
          description: check.detail,
        });
      }
    }
  }

  return items;
}

export function countReadyChecks(shell: ShellState): { ready: number; total: number } {
  if (!shell.session?.checks) {
    return { ready: 0, total: 0 };
  }
  const total = shell.session.checks.length;
  const ready = shell.session.checks.filter((c) => c.status === "ready").length;
  return { ready, total };
}