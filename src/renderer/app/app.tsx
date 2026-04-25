import { AppProvider } from "@/renderer/components/console";
import {
  DashboardScreen,
  GroupsScreen,
  DirectoryScreen,
  ReportsScreen,
  SettingsScreen,
} from "@/renderer/components/console/screens";
import { useApp } from "@/renderer/components/console";
import { Toaster } from "@/renderer/components/ui/sonner";

function AppContent() {
  const { currentScreen } = useApp();

  const renderScreen = () => {
    switch (currentScreen) {
      case "dashboard":
        return <DashboardScreen />;
      case "groups":
        return <GroupsScreen />;
      case "directory":
        return <DirectoryScreen />;
      case "reports":
        return <ReportsScreen />;
      case "settings":
        return <SettingsScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  return <>{renderScreen()}</>;
}

export function App() {
  return (
    <AppProvider>
      <AppContent />
      <Toaster richColors position="bottom-right" />
    </AppProvider>
  );
}
