import type { ShellState } from "./app-context";

export type ReadinessLevel = "signedOut" | "partial" | "ready";

export type AuthSetupStep =
  | "graphNeeded"
  | "exchangeNeeded"
  | "mismatched"
  | "ready";

export interface ShellReadinessSummary {
  readiness: ReadinessLevel;
  displayName: string;
  secondaryLine: string;
  graphConnected: boolean;
  exchangeActive: boolean;
  setupStep: AuthSetupStep;
}

export function deriveAuthSetupStep(shell: ShellState): AuthSetupStep {
  const graph = shell.graphConnection;
  const exchange = shell.exchangeConnection;

  const graphConnected = graph?.state === "connected";
  const exchangeActive = exchange?.state === "connected";

  if (!graphConnected) {
    return "graphNeeded";
  }

  if (graphConnected && !exchangeActive) {
    return "exchangeNeeded";
  }

  if (graphConnected && exchangeActive && graph?.exchangeAlignment === "matched") {
    return "ready";
  }

  if (graphConnected && exchangeActive && graph?.exchangeAlignment !== "matched") {
    return "mismatched";
  }

  return "graphNeeded";
}

export function deriveShellReadiness(shell: ShellState): ShellReadinessSummary {
  const graph = shell.graphConnection;
  const exchange = shell.exchangeConnection;

  const graphConnected = graph?.state === "connected";
  const exchangeActive = exchange?.state === "connected";

  const displayName =
    graph?.accountDisplayName ??
    graph?.accountUsername ??
    exchange?.userPrincipalName ??
    "Not connected";

  const secondaryLine =
    graph?.accountUsername ??
    exchange?.userPrincipalName ??
    shell.session?.environment ??
    "No active session";

  const graphDisconnected = !graph || graph.state === "disconnected";
  const exchangeDisconnected = !exchange || exchange.state === "disconnected";

  let readiness: ReadinessLevel;

  if (graphConnected && exchangeActive && graph?.exchangeAlignment === "matched") {
    readiness = "ready";
  } else if (graphDisconnected && exchangeDisconnected) {
    readiness = "signedOut";
  } else {
    readiness = "partial";
  }

  const setupStep = deriveAuthSetupStep(shell);

  return {
    readiness,
    displayName,
    secondaryLine,
    graphConnected,
    exchangeActive,
    setupStep,
  };
}