/* ============================================
   Sidebar Component
   ============================================ */
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
} from 'lucide-react';
import { useWorkspaceStore } from '../store';

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
  } = useWorkspaceStore();

  const bookmarkedApps = connectedApps.filter((a) => bookmarkedAppIds.includes(a.id));

  const sidebarClass = [
    'app-sidebar',
    sidebarCollapsed ? 'collapsed' : '',
    sidebarOpen ? 'open' : '',
  ].filter(Boolean).join(' ');

  const navItems = [
    { icon: Home, label: 'Home', view: 'home' as const },
    { icon: LayoutGrid, label: 'Connected Apps', view: 'apps' as const, count: connectedApps.length },
    { icon: Settings, label: 'Settings', view: 'settings' as const },
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
              {bookmarkedApps.map((app) => (
                <button
                  key={app.id}
                  className="sidebar-item"
                  title={sidebarCollapsed ? app.repoName : undefined}
                  aria-label={`Open bookmarked ${app.repoName}`}
                  onClick={() => {
                    const existingTab = openTabs.find((t) => t.appId === app.id);
                    if (existingTab) {
                      setActiveTab(existingTab.id);
                    } else {
                      openTab({
                        id: `tab-${app.id}`,
                        appId: app.id,
                        title: app.repoName,
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
                    {app.repoName}
                  </span>
                </button>
              ))}
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
          <button
            className="sidebar-item"
            title={sidebarCollapsed ? (theme === 'light' ? 'Dark Mode' : 'Light Mode') : undefined}
            aria-label={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            onClick={toggleTheme}
          >
            {theme === 'light' ? <Moon size={18} className="sidebar-item-icon" /> : <Sun size={18} className="sidebar-item-icon" />}
            {!sidebarCollapsed && <span style={{ textAlign: 'left' }}>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>}
          </button>

          {user && (
            <button
              className="sidebar-item"
              title={sidebarCollapsed ? (user.displayName || user.email) : undefined}
              aria-label={user.displayName || user.email}
              onClick={() => setActiveView('settings')}
            >
              <User size={18} className="sidebar-item-icon" />
              {!sidebarCollapsed && (
                <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.displayName || user.email}
                </span>
              )}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
