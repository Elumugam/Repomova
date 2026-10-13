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
import { NewWorkspaceView } from './components/NewWorkspaceView';
import { supabase, isSupabaseConfigured, loadBookmarksFromSupabase } from './lib/supabase';

export default function App() {
  const {
    theme,
    activeView,
    openTabs,
    activeTabId,
    connectedApps,
    user,
    setUser,
    setBookmarkedAppIds,
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

        // Load persisted bookmarks from Supabase
        loadBookmarksFromSupabase(session.user.id).then((serverBookmarks) => {
          if (!isMounted || serverBookmarks.length === 0) return;
          const current = useWorkspaceStore.getState().bookmarkedAppIds;
          const merged = Array.from(new Set([...current, ...serverBookmarks]));
          setBookmarkedAppIds(merged);
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

        loadBookmarksFromSupabase(session.user.id).then((serverBookmarks) => {
          if (!isMounted || serverBookmarks.length === 0) return;
          const current = useWorkspaceStore.getState().bookmarkedAppIds;
          const merged = Array.from(new Set([...current, ...serverBookmarks]));
          setBookmarkedAppIds(merged);
        });
      } else {
        setUser(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [user, setUser, setBookmarkedAppIds]);

  return (
    <div className="app-layout">
      <Sidebar />

      <div className="app-main">
        <Topbar />
        <div className="app-content">
          {activeView === 'home' && <WelcomeScreen />}
          {activeView === 'settings' && <SettingsView />}

          <div
            className="workspace-container"
            style={{
              display: activeView === 'apps' ? 'flex' : 'none',
              flexDirection: 'column',
              height: '100%',
              width: '100%',
              flex: 1,
            }}
          >
            {openTabs.length === 0 ? (
              <ConnectedAppsView />
            ) : (
              openTabs.map((tab) => {
                const isCurrent = tab.id === activeTabId;
                const app = connectedApps.find((a) => a.id === tab.appId);

                return (
                  <div
                    key={tab.id}
                    style={{
                      display: isCurrent ? 'flex' : 'none',
                      flexDirection: 'column',
                      height: '100%',
                      width: '100%',
                      flex: 1,
                    }}
                  >
                    {app ? (
                      <AppPreview app={app} />
                    ) : (
                      <NewWorkspaceView tabId={tab.id} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Global modals */}
      <ConnectModal />
    </div>
  );
}
