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
import { supabase, isSupabaseConfigured } from './lib/supabase';

export default function App() {
  const {
    theme,
    activeView,
    openTabs,
    activeTabId,
    connectedApps,
    user,
    setUser,
  } = useWorkspaceStore();

  // Apply theme on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Sync Supabase authentication session on mount
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isMounted = true;
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isMounted) return;
      if (error) {
        console.warn('[Repomova] Error retrieving session:', error.message);
        return;
      }
      if (session?.user && !user) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          displayName:
            session.user.user_metadata?.displayName ||
            session.user.user_metadata?.full_name ||
            session.user.email?.split('@')[0] ||
            'User',
          createdAt: session.user.created_at,
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          displayName:
            session.user.user_metadata?.displayName ||
            session.user.user_metadata?.full_name ||
            session.user.email?.split('@')[0] ||
            'User',
          createdAt: session.user.created_at,
        });
      } else {
        setUser(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [user, setUser]);

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
