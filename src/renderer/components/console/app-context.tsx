import { createContext, useContext, useState, type ReactNode } from "react";

type Screen = "dashboard" | "groups" | "directory" | "reports" | "settings";

interface AppContextValue {
  currentScreen: Screen;
  setCurrentScreen: (screen: Screen) => void;
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

  return (
    <AppContext.Provider value={{ currentScreen, setCurrentScreen }}>
      {children}
    </AppContext.Provider>
  );
}
