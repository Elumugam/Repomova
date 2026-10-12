/* ============================================
   App — Main Repomova Application
   ============================================ */
import { useEffect } from 'react';
import { useWorkspaceStore } from './store';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ConnectedAppsView } from './components/ConnectedAppsView';
import { ConnectModal } from './components/ConnectModal';
import { SettingsView } from './components/SettingsView';
import { AppPreview } from './components/AppPreview';

export default function App() {
  const {
    theme,
    activeView,
    openTabs,
    activeTabId,
    connectedApps,
  } = useWorkspaceStore();

  // Apply theme on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Find the active tab's associated app
  const activeTab = openTabs.find((t) => t.id === activeTabId);
  const activeApp = activeTab
    ? connectedApps.find((a) => a.id === activeTab.appId)
    : null;

  // Determine main content
  function renderContent() {
    // If there's an active tab, show its preview
    if (activeTab && activeApp) {
      return <AppPreview app={activeApp} />;
    }

    // Otherwise show the view
    switch (activeView) {
      case 'apps':
        return <ConnectedAppsView />;
      case 'settings':
        return <SettingsView />;
      case 'home':
      default:
        return <WelcomeScreen />;
    }
  }

  return (
    <div className="app-layout">
      <Sidebar />

      <div className="app-main">
        <Topbar />
        <div className="app-content">
          {renderContent()}
        </div>
      </div>

      {/* Global modals */}
      <ConnectModal />
    </div>
  );
}
