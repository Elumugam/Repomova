/* ============================================
   Sidebar Component
   ============================================ */
import { useState, useRef, useEffect } from 'react';
import {
  Home,
  LayoutGrid,
  Bookmark,
  Plus,
  Settings,
  User,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeft,
  LogIn,
  UserPlus,
  LogOut,
  Shield,
} from 'lucide-react';
import { useWorkspaceStore } from '../store';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export function Sidebar() {
  const {
    sidebarCollapsed,
    sidebarOpen,
    toggleSidebarCollapse,
    setSidebarOpen,
    activeView,
    setActiveView,
    setConnectModalOpen,
    connectedApps,
    bookmarkedAppIds,
    openTabs,
    openTab,
    setActiveTab,
    theme,
    toggleTheme,
    user,
    isAuthenticated,
    setUser,
    setSettingsTab,
    setAuthMode,
  } = useWorkspaceStore();

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);

  // Close profile menu on outside click or Escape key
  useEffect(() => {
    if (!profileMenuOpen) return;

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(target) &&
        profileButtonRef.current &&
        !profileButtonRef.current.contains(target)
      ) {
        setProfileMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileMenuOpen]);

  const bookmarkedApps = connectedApps.filter((a) => bookmarkedAppIds.includes(a.id));

  const sidebarClass = [
    'app-sidebar',
    sidebarCollapsed ? 'collapsed' : '',
    sidebarOpen ? 'open' : '',
  ].filter(Boolean).join(' ');

  // Settings removed from standalone nav; now accessible through Profile Menu
  const navItems = [
    { icon: Home, label: 'Home', view: 'home' as const },
    { icon: LayoutGrid, label: 'Connected Apps', view: 'apps' as const, count: connectedApps.length },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="modal-overlay"
          style={{ zIndex: 'var(--z-sidebar)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={sidebarClass} aria-label="Main Navigation">
        {/* Header */}
        <div className="sidebar-header">
          {!sidebarCollapsed ? (
            <div className="sidebar-brand-group">
              <img
                src="/repomova-icon.png"
                alt="Repomova"
                className="sidebar-logo"
              />
              <span className="sidebar-brand">Repomova</span>
            </div>
          ) : (
            <img
              src="/repomova-icon.png"
              alt="Repomova"
              className="sidebar-logo"
            />
          )}

          <button
            className="btn btn-icon btn-ghost btn-sm sidebar-collapse-btn"
            onClick={toggleSidebarCollapse}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!sidebarCollapsed}
          >
            {sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const tooltipText = item.count !== undefined && item.count > 0
              ? `${item.label} (${item.count})`
              : item.label;

            return (
              <button
                key={item.view}
                className={`sidebar-item ${activeView === item.view ? 'active' : ''}`}
                title={sidebarCollapsed ? tooltipText : undefined}
                aria-label={tooltipText}
                aria-current={activeView === item.view ? 'page' : undefined}
                onClick={() => {
                  setActiveView(item.view);
                  setSidebarOpen(false);
                }}
              >
                <item.icon size={18} className="sidebar-item-icon" />
                {!sidebarCollapsed && (
                  <>
                    <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                    {item.count !== undefined && item.count > 0 && (
                      <span
                        className="badge"
                        style={{
                          background: 'var(--color-bg-tertiary)',
                          color: 'var(--color-text-tertiary)',
                        }}
                      >
                        {item.count}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}

          {/* Bookmarked Applications */}
          {bookmarkedApps.length > 0 && !sidebarCollapsed && (
            <div className="sidebar-section">
              <div className="sidebar-section-label">
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Bookmark size={10} /> Bookmarks
                </span>
              </div>
              {bookmarkedApps.map((app) => {
                const displayName = app.displayName || app.repoName;
                return (
                  <button
                    key={app.id}
                    className="sidebar-item"
                    title={sidebarCollapsed ? displayName : undefined}
                    aria-label={`Open bookmarked ${displayName}`}
                    onClick={() => {
                      const existingTab = openTabs.find((t) => t.appId === app.id);
                      if (existingTab) {
                        setActiveTab(existingTab.id);
                      } else {
                        openTab({
                          id: `tab-${app.id}`,
                          appId: app.id,
                          title: displayName,
                          status: app.status,
                          previewUrl: app.previewUrl,
                        });
                      }
                      setActiveView('apps');
                      setSidebarOpen(false);
                    }}
                  >
                    <span
                      className="status-dot"
                      style={{
                        background:
                          app.status === 'running'
                            ? 'var(--color-status-running)'
                            : app.status === 'failed'
                            ? 'var(--color-status-error)'
                            : 'var(--color-status-stopped)',
                        width: '6px',
                        height: '6px',
                      }}
                    />
                    <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {displayName}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Connect button */}
          <button
            className="sidebar-item"
            style={{ marginTop: 'var(--space-2)' }}
            title={sidebarCollapsed ? 'Connect Repository' : undefined}
            aria-label="Connect Repository"
            onClick={() => setConnectModalOpen(true)}
          >
            <Plus size={18} className="sidebar-item-icon" />
            {!sidebarCollapsed && <span style={{ textAlign: 'left' }}>Connect Repository</span>}
          </button>
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {/* Profile Menu Popover */}
          {profileMenuOpen && (
            <div
              ref={profileMenuRef}
              className={`sidebar-profile-menu ${sidebarCollapsed ? 'sidebar-profile-menu-collapsed' : ''}`}
              role="menu"
              aria-label="Profile and account menu"
            >
              {isAuthenticated && user ? (
                <>
                  <div className="profile-menu-header profile-user-header">
                    <div className="profile-menu-avatar">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.displayName} />
                      ) : (
                        <span>
                          {user.displayName?.charAt(0).toUpperCase() ||
                            user.email?.charAt(0).toUpperCase() ||
                            'U'}
                        </span>
                      )}
                    </div>
                    <div className="profile-menu-info">
                      <div className="profile-menu-name">{user.displayName || 'Developer'}</div>
                      <div className="profile-menu-email">{user.email}</div>
                    </div>
                  </div>

                  <div className="profile-menu-divider" />

                  <button
                    className="profile-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setSettingsTab('account');
                      setActiveView('settings');
                      setProfileMenuOpen(false);
                      setSidebarOpen(false);
                    }}
                  >
                    <User size={16} className="profile-menu-item-icon" />
                    <span>Profile</span>
                  </button>

                  <button
                    className="profile-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setSettingsTab('appearance');
                      setActiveView('settings');
                      setProfileMenuOpen(false);
                      setSidebarOpen(false);
                    }}
                  >
                    <Settings size={16} className="profile-menu-item-icon" />
                    <span>Settings</span>
                  </button>

                  <button
                    className="profile-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setSettingsTab('security');
                      setActiveView('settings');
                      setProfileMenuOpen(false);
                      setSidebarOpen(false);
                    }}
                  >
                    <Shield size={16} className="profile-menu-item-icon" />
                    <span>Security</span>
                  </button>

                  <div className="profile-menu-divider" />

                  <button
                    className="profile-menu-item profile-menu-item-danger"
                    role="menuitem"
                    onClick={async () => {
                      if (isSupabaseConfigured) {
                        try {
                          await supabase.auth.signOut();
                        } catch (err) {
                          console.warn('[Repomova] Sign out error:', err);
                        }
                      }
                      setUser(null);
                      setProfileMenuOpen(false);
                    }}
                  >
                    <LogOut size={16} className="profile-menu-item-icon" />
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="profile-menu-header">
                    <div className="profile-menu-title">Account</div>
                    <div className="profile-menu-subtitle">Sign in to save apps & access settings</div>
                  </div>

                  <div className="profile-menu-divider" />

                  <button
                    className="profile-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setSettingsTab('account');
                      setAuthMode('login');
                      setActiveView('settings');
                      setProfileMenuOpen(false);
                      setSidebarOpen(false);
                    }}
                  >
                    <LogIn size={16} className="profile-menu-item-icon" />
                    <span>Sign In</span>
                  </button>

                  <button
                    className="profile-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setSettingsTab('account');
                      setAuthMode('signup');
                      setActiveView('settings');
                      setProfileMenuOpen(false);
                      setSidebarOpen(false);
                    }}
                  >
                    <UserPlus size={16} className="profile-menu-item-icon" />
                    <span>Sign Up</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* Theme Toggle */}
          <button
            className="sidebar-item"
            title={sidebarCollapsed ? (theme === 'light' ? 'Dark Mode' : 'Light Mode') : undefined}
            aria-label={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            onClick={toggleTheme}
          >
            {theme === 'light' ? <Moon size={18} className="sidebar-item-icon" /> : <Sun size={18} className="sidebar-item-icon" />}
            {!sidebarCollapsed && <span style={{ textAlign: 'left' }}>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>}
          </button>

          {/* Profile Button - always visible in both collapsed and expanded states */}
          <button
            ref={profileButtonRef}
            className={`sidebar-item sidebar-profile-btn ${profileMenuOpen ? 'active' : ''}`}
            title={sidebarCollapsed ? (user ? (user.displayName || user.email) : 'Profile') : undefined}
            aria-label={user ? (user.displayName || user.email) : 'Profile'}
            aria-haspopup="menu"
            aria-expanded={profileMenuOpen}
            onClick={() => setProfileMenuOpen((prev) => !prev)}
          >
            {user ? (
              <div className="sidebar-user-avatar">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.displayName} />
                ) : (
                  <span>
                    {user.displayName?.charAt(0).toUpperCase() ||
                      user.email?.charAt(0).toUpperCase() ||
                      'U'}
                  </span>
                )}
              </div>
            ) : (
              <User size={18} className="sidebar-item-icon" />
            )}

            {!sidebarCollapsed && (
              <div className="sidebar-profile-label">
                <span className="sidebar-profile-name">
                  {user ? (user.displayName || user.email) : 'Profile'}
                </span>
                {user && <span className="sidebar-profile-email">{user.email}</span>}
              </div>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
