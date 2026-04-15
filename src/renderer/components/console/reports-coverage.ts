import type { ShellState } from "./app-context";

export type CapabilityStatus = "available" | "partial" | "deferred" | "unavailable";

export interface CapabilityRow {
  id: string;
  surface: string;
  status: CapabilityStatus;
  detail: string;
}

export interface CoverageSummary {
  available: number;
  deferred: number;
  total: number;
}

export function deriveCapabilityRows(shell: ShellState): CapabilityRow[] {
  const rows: CapabilityRow[] = [];

  const checks = shell.session?.checks;
  if (checks && checks.length > 0) {
    const allReady = checks.every((c) => c.status === "ready");
    const readyCount = checks.filter((c) => c.status === "ready").length;
    rows.push({
      id: "shell-bootstrap",
      surface: "Shell Bootstrap",
      status: allReady ? "available" : readyCount > 0 ? "partial" : "unavailable",
      detail: allReady
        ? "All bootstrap checks passed"
        : `${readyCount}/${checks.length} checks ready`,
    });
  } else {
    rows.push({
      id: "shell-bootstrap",
      surface: "Shell Bootstrap",
      status: "unavailable",
      detail: "No session data loaded",
    });
  }

  const exchangeConnected = shell.exchangeConnection?.state === "connected";
  rows.push({
    id: "exchange-connection",
    surface: "Exchange Connection",
    status: exchangeConnected
      ? "available"
      : shell.exchangeConnection?.state === "error"
        ? "unavailable"
        : "unavailable",
    detail: exchangeConnected
      ? `Connected as ${shell.exchangeConnection?.userPrincipalName ?? "unknown"}`
      : shell.exchangeConnection?.state === "error"
        ? shell.exchangeConnection.detail
        : "Not connected",
  });

  const graphConnected = shell.graphConnection?.state === "connected";
  rows.push({
    id: "graph-connection",
    surface: "Graph Connection",
    status: graphConnected
      ? "available"
      : shell.graphConnection?.state === "error"
        ? "unavailable"
        : "unavailable",
    detail: graphConnected
      ? `Connected as ${shell.graphConnection?.accountDisplayName ?? shell.graphConnection?.accountUsername ?? "unknown"}`
      : shell.graphConnection?.state === "error"
        ? shell.graphConnection.detail
        : "Not connected",
  });

  rows.push({
    id: "group-inventory",
    surface: "Group Inventory",
    status: exchangeConnected ? "available" : "unavailable",
    detail: exchangeConnected
      ? "Exchange group listing available"
      : "Requires Exchange connection",
  });

  rows.push({
    id: "guest-contact-workflows",
    surface: "Guest & Contact Workflows",
    status: graphConnected ? "available" : "unavailable",
    detail: graphConnected
      ? "Guest invite and contact workflows available"
      : "Requires Graph connection",
  });

  rows.push({
    id: "report-export",
    surface: "Report & Export",
    status: exchangeConnected ? "available" : "unavailable",
    detail: exchangeConnected
      ? "Membership matrix export available"
      : "Requires Exchange connection",
  });

  rows.push({
    id: "audit-observability",
    surface: "Audit & Observability",
    status: "deferred",
    detail: "No audit backend or structured logging pipeline",
  });

  return rows;
}

export function deriveCoverageSummary(rows: CapabilityRow[]): CoverageSummary {
  const available = rows.filter((r) => r.status === "available").length;
  const deferred = rows.filter((r) => r.status === "deferred").length;
  return {
    available,
    deferred,
    total: rows.length,
  };
}
