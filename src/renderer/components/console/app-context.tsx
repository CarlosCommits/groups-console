import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { SessionStatusSchema } from "@/shared/contracts/session";
import type { ExchangeCapabilities, ExchangeConnectionStatus } from "@/shared/contracts/exchange";
import type { GraphConnectionStatus } from "@/shared/contracts/graph";

type Screen = "dashboard" | "groups" | "directory" | "reports" | "settings";

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

interface AppContextValue {
  currentScreen: Screen;
  setCurrentScreen: (screen: Screen) => void;
  shell: ShellState;
  refreshShellState: () => Promise<void>;
  pendingAction: PendingAction;
  actionErrors: ActionErrors;
  exchangeUpn: string;
  setExchangeUpn: (upn: string) => void;
  connectGraph: () => Promise<void>;
  disconnectGraph: () => Promise<void>;
  connectExchange: () => Promise<void>;
  disconnectExchange: () => Promise<void>;
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
  return true;
}

function requireServices(...services: Array<"session" | "graph" | "exchange">): boolean {
  return services.every((service) => requireBridge(service));
}

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [currentScreen, setCurrentScreen] = useState<Screen>("dashboard");
  const [shell, setShell] = useState<ShellState>({
    session: null,
    exchangeCapabilities: null,
    graphConnection: null,
    exchangeConnection: null,
    isHydrating: true,
    loadError: null,
  });

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionErrors, setActionErrors] = useState<ActionErrors>({});

  const exchangeUpnPreset =
    shell.exchangeConnection?.userPrincipalName ??
    shell.graphConnection?.accountUsername ??
    "";
  const [exchangeUpn, setExchangeUpn] = useState(exchangeUpnPreset);
  const userEditedUpn = useRef(false);
  const previousExchangeUpnPreset = useRef(exchangeUpnPreset);

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

  const refreshShellState = useCallback(async () => {
    setShell((prev) => ({ ...prev, isHydrating: true, loadError: null }));

    try {
      if (!requireServices("session", "exchange", "graph")) {
        setShell({
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

      setShell({
        session,
        exchangeCapabilities,
        graphConnection,
        exchangeConnection,
        isHydrating: false,
        loadError: null,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load application state.";
      setShell({
        session: null,
        exchangeCapabilities: null,
        graphConnection: null,
        exchangeConnection: null,
        isHydrating: false,
        loadError: message,
      });
    }
  }, []);

  useEffect(() => {
    void refreshShellState();
  }, [refreshShellState]);

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
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Graph connect failed.";
      setActionErrors((prev) => ({ ...prev, graph: message }));
    } finally {
      setPendingAction(null);
      await refreshShellState();
    }
  }, [clearError, refreshShellState]);

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
      const message = err instanceof Error ? err.message : "Graph disconnect failed.";
      setActionErrors((prev) => ({ ...prev, graph: message }));
    } finally {
      setPendingAction(null);
      await refreshShellState();
    }
  }, [clearError, refreshShellState]);

  const connectExchange = useCallback(async () => {
    if (!requireBridge("exchange")) {
      setActionErrors((prev) => ({
        ...prev,
        exchange: "Application bridge is not available. Please restart the application.",
      }));
      return;
    }
    setPendingAction("exchangeConnect");
    clearError("exchange");
    try {
      const result = await window.radApp.exchange.connect(exchangeUpn.trim());
      if (result.state === "error") {
        setActionErrors((prev) => ({ ...prev, exchange: result.detail }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Exchange connect failed.";
      setActionErrors((prev) => ({ ...prev, exchange: message }));
    } finally {
      setPendingAction(null);
      await refreshShellState();
    }
  }, [clearError, exchangeUpn, refreshShellState]);

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
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Exchange disconnect failed.";
      setActionErrors((prev) => ({ ...prev, exchange: message }));
    } finally {
      setPendingAction(null);
      await refreshShellState();
    }
  }, [clearError, refreshShellState]);

  return (
    <AppContext.Provider
      value={{
        currentScreen,
        setCurrentScreen,
        shell,
        refreshShellState,
        pendingAction,
        actionErrors,
        exchangeUpn,
        setExchangeUpn: handleSetExchangeUpn,
        connectGraph,
        disconnectGraph,
        connectExchange,
        disconnectExchange,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
