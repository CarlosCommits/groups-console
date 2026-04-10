import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { SessionStatusSchema } from "@/shared/contracts/session";
import type { ExchangeCapabilities, ExchangeConnectionStatus } from "@/shared/contracts/exchange";
import type { GraphConnectionStatus } from "@/shared/contracts/graph";

type Screen = "dashboard" | "groups" | "directory" | "reports" | "settings";

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
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
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

  const refreshShellState = useCallback(async () => {
    setShell((prev) => ({ ...prev, isHydrating: true, loadError: null }));

    try {
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
      setShell((prev) => ({
        ...prev,
        isHydrating: false,
        loadError: message,
      }));
    }
  }, []);

  useEffect(() => {
    void refreshShellState();
  }, [refreshShellState]);

  return (
    <AppContext.Provider value={{ currentScreen, setCurrentScreen, shell, refreshShellState }}>
      {children}
    </AppContext.Provider>
  );
}