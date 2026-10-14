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
import { isSupabaseConfigured, loadBookmarksFromSupabase } from './lib/supabase';
import { repomovaAuth } from './lib/auth';

export default function App() {
  const {
    theme,
    activeView,
    openTabs,
    activeTabId,
    connectedApps,
    setUser,
    setBookmarkedAppIds,
  } = useWorkspaceStore();

  // Apply theme on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Sync Repomova authentication session on mount and restore persisted session
  useEffect(() => {
    let isMounted = true;

    // Check existing active session on mount
    repomovaAuth.getSession().then(({ session, error }) => {
      if (!isMounted) return;
      if (error) {
        console.warn('[Repomova] Error retrieving session:', error.message);
        return;
      }
      if (session?.user) {
        setUser(session.user);

        // Load persisted bookmarks from Supabase if configured
        if (isSupabaseConfigured) {
          loadBookmarksFromSupabase(session.user.id).then((serverBookmarks) => {
            if (!isMounted || serverBookmarks.length === 0) return;
            const current = useWorkspaceStore.getState().bookmarkedAppIds;
            const merged = Array.from(new Set([...current, ...serverBookmarks]));
            setBookmarkedAppIds(merged);
          });
        }
      }
    });

    // Listen for auth state changes (sign-in, sign-out, profile updates)
    const {
      data: { subscription },
    } = repomovaAuth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (session?.user) {
        setUser(session.user);

        if (isSupabaseConfigured) {
          loadBookmarksFromSupabase(session.user.id).then((serverBookmarks) => {
            if (!isMounted || serverBookmarks.length === 0) return;
            const current = useWorkspaceStore.getState().bookmarkedAppIds;
            const merged = Array.from(new Set([...current, ...serverBookmarks]));
            setBookmarkedAppIds(merged);
          });
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [setUser, setBookmarkedAppIds]);

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
