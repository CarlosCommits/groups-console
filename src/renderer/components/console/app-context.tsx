import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { SessionStatusSchema } from "@/shared/contracts/session";
import type { ExchangeCapabilities, ExchangeConnectionStatus } from "@/shared/contracts/exchange";
import type { GraphConnectionStatus } from "@/shared/contracts/graph";
import type {
  ReportGroupKind,
  ReportsGenerateMembershipMatrixResult,
} from "@/shared/contracts/reports";
import type { ProgressEvent } from "@/shared/contracts/command";
import { formatPresentedCommandFailure, presentCommandFailure } from "./command-failure-presenter";
import { purgeAppQueryCacheForConnectionBoundary } from "@/renderer/lib/query-client";

export type Screen = "dashboard" | "groups" | "directory" | "reports" | "settings";

export type PendingAction =
  | "graphConnect"
  | "graphDisconnect"
  | "exchangeConnect"
  | "exchangeDisconnect"
  | null;

export interface ActionErrors {
  graph?: string;
  exchange?: string;
}

export interface ShellState {
  session: SessionStatusSchema | null;
  exchangeCapabilities: ExchangeCapabilities | null;
  graphConnection: GraphConnectionStatus | null;
  exchangeConnection: ExchangeConnectionStatus | null;
  isHydrating: boolean;
  loadError: string | null;
}

export interface DirectoryScreenState {
  activeTab: string;
  searchText: string;
  effectiveQuery: string;
}

export interface GroupsScreenState {
  selectedGroupExchangeIdentity: string | null;
  activeTab: string;
  sortBy: string;
  groupFilter: string;
  memberFilter: string;
}

export type MembershipMatrixGenerationPhase = "idle" | "generating" | "success" | "error";

export interface MembershipMatrixGenerationState {
  requestedKind: ReportGroupKind | null;
  phase: MembershipMatrixGenerationPhase;
  progressMessage: string;
  progressPercent: number;
  result: ReportsGenerateMembershipMatrixResult | null;
  error: string | null;
}

export const initialMembershipMatrixGenerationState: MembershipMatrixGenerationState = {
  requestedKind: null,
  phase: "idle",
  progressMessage: "",
  progressPercent: 0,
  result: null,
  error: null,
};

export function createGeneratingMembershipMatrixState(
  requestedKind: ReportGroupKind,
): MembershipMatrixGenerationState {
  return {
    requestedKind,
    phase: "generating",
    progressMessage: "Starting…",
    progressPercent: 0,
    result: null,
    error: null,
  };
}

export function applyMembershipMatrixProgress(
  previous: MembershipMatrixGenerationState,
  event: ProgressEvent,
): MembershipMatrixGenerationState {
  return {
    ...previous,
    phase: "generating",
    progressMessage: event.message,
    progressPercent: event.percent ?? previous.progressPercent,
    error: null,
  };
}

export function createMembershipMatrixSuccessState(
  result: ReportsGenerateMembershipMatrixResult,
  requestedKind: ReportGroupKind,
): MembershipMatrixGenerationState {
  return {
    requestedKind,
    phase: "success",
    progressMessage: "",
    progressPercent: 100,
    result,
    error: null,
  };
}

export function createMembershipMatrixErrorState(
  error: string,
  requestedKind: ReportGroupKind | null,
): MembershipMatrixGenerationState {
  return {
    requestedKind,
    phase: "error",
    progressMessage: "",
    progressPercent: 0,
    result: null,
    error,
  };
}

interface AppContextValue {
  currentScreen: Screen;
  setCurrentScreen: (screen: Screen) => void;
  shell: ShellState;
  directoryScreenState: DirectoryScreenState;
  setDirectoryScreenState: Dispatch<SetStateAction<DirectoryScreenState>>;
  groupsScreenState: GroupsScreenState;
  setGroupsScreenState: Dispatch<SetStateAction<GroupsScreenState>>;
  lastExchangeConnectFailure: string | null;
  refreshShellState: () => Promise<void>;
  pendingAction: PendingAction;
  actionErrors: ActionErrors;
  membershipMatrixGeneration: MembershipMatrixGenerationState;
  exchangeUpn: string;
  setExchangeUpn: (upn: string) => void;
  connectGraph: () => Promise<void>;
  disconnectGraph: () => Promise<void>;
  connectExchange: () => Promise<void>;
  disconnectExchange: () => Promise<void>;
  generateMembershipMatrix: (kind: ReportGroupKind) => Promise<void>;
  clearMembershipMatrixGeneration: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}

function requireBridge(service: string): boolean {
  if (typeof window === "undefined" || !window.radApp) {
    return false;
  }
  if (service === "graph" && !window.radApp.graph) {
    return false;
  }
  if (service === "exchange" && !window.radApp.exchange) {
    return false;
  }
  if (service === "session" && !window.radApp.session) {
    return false;
  }
  if (service === "reports" && !window.radApp.reports) {
    return false;
  }
  return true;
}

function requireServices(...services: Array<"session" | "graph" | "exchange" | "reports">): boolean {
  return services.every((service) => requireBridge(service));
}

interface AppProviderProps {
  children: ReactNode;
}

const initialShellState: ShellState = {
  session: null,
  exchangeCapabilities: null,
  graphConnection: null,
  exchangeConnection: null,
  isHydrating: true,
  loadError: null,
};

export const initialDirectoryScreenState: DirectoryScreenState = {
  activeTab: "all",
  searchText: "",
  effectiveQuery: "",
};

export const initialGroupsScreenState: GroupsScreenState = {
  selectedGroupExchangeIdentity: null,
  activeTab: "members",
  sortBy: "name",
  groupFilter: "",
  memberFilter: "",
};

export function getExchangeUpnPreset(
  shell: Pick<ShellState, "exchangeConnection" | "graphConnection">,
) {
  return shell.exchangeConnection?.userPrincipalName ?? shell.graphConnection?.accountUsername ?? "";
}

interface ResolveAutoExchangeUpnAfterGraphConnectOptions {
  graphResult: GraphConnectionStatus;
  exchangeConnection: ExchangeConnectionStatus | null;
  exchangeUpn: string;
  userEditedUpn: boolean;
}

export function resolveAutoExchangeUpnAfterGraphConnect({
  graphResult,
  exchangeConnection,
  exchangeUpn,
  userEditedUpn,
}: ResolveAutoExchangeUpnAfterGraphConnectOptions): string | null {
  if (graphResult.state !== "connected" || exchangeConnection?.state === "connected") {
    return null;
  }

  const trimmedExchangeUpn = exchangeUpn.trim();

  if (userEditedUpn && trimmedExchangeUpn.length > 0) {
    return trimmedExchangeUpn;
  }

  const graphAccountUsername = graphResult.accountUsername?.trim() ?? "";

  if (graphAccountUsername.length > 0) {
    return graphAccountUsername;
  }

  return trimmedExchangeUpn.length > 0 ? trimmedExchangeUpn : null;
}

export function getShellConnectionBoundary(shell: Pick<ShellState, "graphConnection" | "exchangeConnection">) {
  const exchangeBoundary = [
    shell.exchangeConnection?.state ?? "disconnected",
    shell.exchangeConnection?.tenantId ?? "none",
    shell.exchangeConnection?.connectionId ?? "none",
    shell.exchangeConnection?.userPrincipalName ?? "none",
  ].join(":");

  const graphBoundary = [
    shell.graphConnection?.state ?? "disconnected",
    shell.graphConnection?.tenantId ?? shell.graphConnection?.configuredTenantId ?? "none",
    shell.graphConnection?.accountUsername ?? "none",
  ].join(":");

  return `exchange:${exchangeBoundary}|graph:${graphBoundary}`;
}

export function resolveLastExchangeConnectFailureAfterRefresh(
  currentFailure: string | null,
  previousExchangeConnection: ExchangeConnectionStatus | null,
  exchangeConnection: ExchangeConnectionStatus | null,
) {
  if (exchangeConnection?.state === "connected") {
    return null;
  }

  if (
    previousExchangeConnection?.state === "connected" &&
    exchangeConnection?.state === "disconnected"
  ) {
    return null;
  }

  return currentFailure;
}

export function AppProvider({ children }: AppProviderProps) {
  const [currentScreen, setCurrentScreen] = useState<Screen>("dashboard");
  const [shell, setShell] = useState<ShellState>(initialShellState);
  const [directoryScreenState, setDirectoryScreenState] = useState<DirectoryScreenState>(
    initialDirectoryScreenState,
  );
  const [groupsScreenState, setGroupsScreenState] = useState<GroupsScreenState>(
    initialGroupsScreenState,
  );
  const [lastExchangeConnectFailure, setLastExchangeConnectFailure] = useState<string | null>(null);

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionErrors, setActionErrors] = useState<ActionErrors>({});
  const [membershipMatrixGeneration, setMembershipMatrixGeneration] = useState<MembershipMatrixGenerationState>(
    initialMembershipMatrixGenerationState,
  );

  const exchangeUpnPreset = getExchangeUpnPreset(shell);
  const [exchangeUpn, setExchangeUpn] = useState(exchangeUpnPreset);
  const userEditedUpn = useRef(false);
  const previousExchangeUpnPreset = useRef(exchangeUpnPreset);
  const shellConnectionBoundaryRef = useRef(getShellConnectionBoundary(initialShellState));
  const exchangeConnectInFlight = useRef(false);

  useEffect(() => {
    if (previousExchangeUpnPreset.current !== exchangeUpnPreset) {
      userEditedUpn.current = false;
      previousExchangeUpnPreset.current = exchangeUpnPreset;
    }

    setExchangeUpn((currentValue) => {
      if (userEditedUpn.current && currentValue.trim().length > 0) {
        return currentValue;
      }
      return exchangeUpnPreset;
    });
  }, [exchangeUpnPreset]);

  const handleSetExchangeUpn = useCallback((upn: string) => {
    userEditedUpn.current = upn.trim().length > 0;
    setExchangeUpn(upn);
  }, []);

  const clearError = useCallback((key: keyof ActionErrors) => {
    setActionErrors((prev) => {
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return prev;
    });
  }, []);

  const applyShellState = useCallback((nextShell: ShellState) => {
    const nextBoundary = getShellConnectionBoundary(nextShell);

    if (shellConnectionBoundaryRef.current !== nextBoundary) {
      purgeAppQueryCacheForConnectionBoundary();
      setDirectoryScreenState(initialDirectoryScreenState);
      setGroupsScreenState(initialGroupsScreenState);
      shellConnectionBoundaryRef.current = nextBoundary;
    }

    setShell(nextShell);
  }, []);

  const refreshShellState = useCallback(async () => {
    setShell((prev) => ({ ...prev, isHydrating: true, loadError: null }));

    try {
      if (!requireServices("session", "exchange", "graph")) {
        applyShellState({
          session: null,
          exchangeCapabilities: null,
          graphConnection: null,
          exchangeConnection: null,
          isHydrating: false,
          loadError: "Application bridge is not available. Please restart the application.",
        });
        return;
      }

      const [session, exchangeCapabilities, graphConnection, exchangeConnection] =
        await Promise.all([
          window.radApp.session.getStatus(),
          window.radApp.exchange.getCapabilities(),
          window.radApp.graph.getConnectionStatus(),
          window.radApp.exchange.getConnectionStatus(),
        ]);

      setLastExchangeConnectFailure((currentFailure) =>
        resolveLastExchangeConnectFailureAfterRefresh(
          currentFailure,
          shell.exchangeConnection,
          exchangeConnection,
        ),
      );

      applyShellState({
        session,
        exchangeCapabilities,
        graphConnection,
        exchangeConnection,
        isHydrating: false,
        loadError: null,
      });
    } catch (err) {
      const presented = presentCommandFailure(
        err,
        "Shell State Error",
        "Failed to load application state.",
      );
      applyShellState({
        session: null,
        exchangeCapabilities: null,
        graphConnection: null,
        exchangeConnection: null,
        isHydrating: false,
        loadError: formatPresentedCommandFailure(presented),
      });
    }
  }, [applyShellState]);

  useEffect(() => {
    void refreshShellState();
  }, [refreshShellState]);

  const attemptExchangeConnect = useCallback(async (userPrincipalName: string): Promise<boolean> => {
    const trimmedUserPrincipalName = userPrincipalName.trim();

    if (trimmedUserPrincipalName.length === 0 || exchangeConnectInFlight.current) {
      return false;
    }

    if (!requireBridge("exchange")) {
      const message = "Application bridge is not available. Please restart the application.";
      setActionErrors((prev) => ({
        ...prev,
        exchange: message,
      }));
      setLastExchangeConnectFailure(message);
      return false;
    }

    setExchangeUpn(trimmedUserPrincipalName);
    setPendingAction("exchangeConnect");
    clearError("exchange");
    exchangeConnectInFlight.current = true;

    try {
      const result = await window.radApp.exchange.connect(trimmedUserPrincipalName);
      if (result.state === "error") {
        setActionErrors((prev) => ({ ...prev, exchange: result.detail }));
        setLastExchangeConnectFailure(result.detail);
      }
    } catch (err) {
      const presented = presentCommandFailure(err, "Exchange Connect Error", "Exchange connect failed.");
      const message = formatPresentedCommandFailure(presented);
      setActionErrors((prev) => ({ ...prev, exchange: message }));
      setLastExchangeConnectFailure(message);
    } finally {
      exchangeConnectInFlight.current = false;
      setPendingAction(null);
    }

    return true;
  }, [clearError]);

  const connectGraph = useCallback(async () => {
    if (!requireBridge("graph")) {
      setActionErrors((prev) => ({
        ...prev,
        graph: "Application bridge is not available. Please restart the application.",
      }));
      return;
    }
    setPendingAction("graphConnect");
    clearError("graph");
    try {
      const result = await window.radApp.graph.connect();
      if (result.state === "error") {
        setActionErrors((prev) => ({ ...prev, graph: result.detail }));
        return;
      }

      const autoExchangeUpn = resolveAutoExchangeUpnAfterGraphConnect({
        graphResult: result,
        exchangeConnection: shell.exchangeConnection,
        exchangeUpn,
        userEditedUpn: userEditedUpn.current,
      });

      if (autoExchangeUpn) {
        await attemptExchangeConnect(autoExchangeUpn);
      }
    } catch (err) {
      const presented = presentCommandFailure(err, "Graph Connect Error", "Graph connect failed.");
      setActionErrors((prev) => ({ ...prev, graph: formatPresentedCommandFailure(presented) }));
    } finally {
      setPendingAction(null);
      await refreshShellState();
    }
  }, [attemptExchangeConnect, clearError, exchangeUpn, refreshShellState, shell.exchangeConnection]);

  const disconnectGraph = useCallback(async () => {
    if (!requireBridge("graph")) {
      setActionErrors((prev) => ({
        ...prev,
        graph: "Application bridge is not available. Please restart the application.",
      }));
      return;
    }
    setPendingAction("graphDisconnect");
    clearError("graph");
    try {
      const result = await window.radApp.graph.disconnect();
      if (result.state === "error") {
        setActionErrors((prev) => ({ ...prev, graph: result.detail }));
      }
    } catch (err) {
      const presented = presentCommandFailure(err, "Graph Disconnect Error", "Graph disconnect failed.");
      setActionErrors((prev) => ({ ...prev, graph: formatPresentedCommandFailure(presented) }));
    } finally {
      setPendingAction(null);
      await refreshShellState();
    }
  }, [clearError, refreshShellState]);

  const connectExchange = useCallback(async () => {
    const attempted = await attemptExchangeConnect(exchangeUpn);

    if (attempted) {
      await refreshShellState();
    }
  }, [attemptExchangeConnect, exchangeUpn, refreshShellState]);

  const disconnectExchange = useCallback(async () => {
    if (!requireBridge("exchange")) {
      setActionErrors((prev) => ({
        ...prev,
        exchange: "Application bridge is not available. Please restart the application.",
      }));
      return;
    }
    setPendingAction("exchangeDisconnect");
    clearError("exchange");
    try {
      const result = await window.radApp.exchange.disconnect();
      if (result.state === "error") {
        setActionErrors((prev) => ({ ...prev, exchange: result.detail }));
      } else {
        setLastExchangeConnectFailure(null);
      }
    } catch (err) {
      const presented = presentCommandFailure(err, "Exchange Disconnect Error", "Exchange disconnect failed.");
      setActionErrors((prev) => ({ ...prev, exchange: formatPresentedCommandFailure(presented) }));
    } finally {
      setPendingAction(null);
      await refreshShellState();
    }
  }, [clearError, refreshShellState]);

  const generateMembershipMatrix = useCallback(async (kind: ReportGroupKind) => {
    if (!requireBridge("reports")) {
      setMembershipMatrixGeneration(
        createMembershipMatrixErrorState(
          "Application bridge is not available. Please restart the application.",
          kind,
        ),
      );
      return;
    }

    setMembershipMatrixGeneration(createGeneratingMembershipMatrixState(kind));

    try {
      const result = await window.radApp.reports.generateMembershipMatrix(
        { kind },
        (event: ProgressEvent) => {
          setMembershipMatrixGeneration((previous) =>
            applyMembershipMatrixProgress(previous, event),
          );
        },
      );

      setMembershipMatrixGeneration(createMembershipMatrixSuccessState(result, kind));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Report generation failed.";
      setMembershipMatrixGeneration(createMembershipMatrixErrorState(message, kind));
    }
  }, []);

  const clearMembershipMatrixGeneration = useCallback(() => {
    setMembershipMatrixGeneration(initialMembershipMatrixGenerationState);
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentScreen,
        setCurrentScreen,
        shell,
        directoryScreenState,
        setDirectoryScreenState,
        groupsScreenState,
        setGroupsScreenState,
        lastExchangeConnectFailure,
        refreshShellState,
        pendingAction,
        actionErrors,
        membershipMatrixGeneration,
        exchangeUpn,
        setExchangeUpn: handleSetExchangeUpn,
        connectGraph,
        disconnectGraph,
        connectExchange,
        disconnectExchange,
        generateMembershipMatrix,
        clearMembershipMatrixGeneration,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
