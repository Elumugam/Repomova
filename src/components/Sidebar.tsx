/* ============================================
   Sidebar Component
   ============================================ */
import {
  Home,
  LayoutGrid,
  Play,
  Clock,
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
    openTabs,
    theme,
    toggleTheme,
    user,
  } = useWorkspaceStore();

  const runningApps = connectedApps.filter((a) => a.status === 'running');

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

      <aside className={sidebarClass}>
        {/* Header */}
        <div className="sidebar-header">
          <img
            src="/repomova-icon.png"
            alt="Repomova"
            className="sidebar-logo"
          />
          {!sidebarCollapsed && (
            <span className="sidebar-brand">Repomova</span>
          )}
          <div style={{ marginLeft: 'auto' }}>
            <button
              className="btn btn-icon btn-ghost btn-sm"
              onClick={toggleSidebarCollapse}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.view}
              className={`sidebar-item ${activeView === item.view ? 'active' : ''}`}
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
                    <span className="badge" style={{
                      background: 'var(--color-bg-tertiary)',
                      color: 'var(--color-text-tertiary)',
                    }}>
                      {item.count}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}

          {/* Running Apps */}
          {runningApps.length > 0 && !sidebarCollapsed && (
            <div className="sidebar-section">
              <div className="sidebar-section-label">
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Play size={10} /> Running
                </span>
              </div>
              {runningApps.map((app) => (
                <button
                  key={app.id}
                  className="sidebar-item"
                  onClick={() => {
                    /* Will open the app tab */
                  }}
                >
                  <span className="status-dot status-running" />
                  <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {app.repoName}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Recent Tabs */}
          {openTabs.length > 0 && !sidebarCollapsed && (
            <div className="sidebar-section">
              <div className="sidebar-section-label">
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={10} /> Open Tabs
                </span>
              </div>
              {openTabs.map((tab) => (
                <button
                  key={tab.id}
                  className="sidebar-item"
                  onClick={() => {
                    /* Will switch to tab */
                  }}
                >
                  <LayoutGrid size={14} className="sidebar-item-icon" />
                  <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tab.title}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Connect button */}
          <button
            className="sidebar-item"
            style={{ marginTop: 'var(--space-2)' }}
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
            onClick={toggleTheme}
          >
            {theme === 'light' ? <Moon size={18} className="sidebar-item-icon" /> : <Sun size={18} className="sidebar-item-icon" />}
            {!sidebarCollapsed && <span style={{ textAlign: 'left' }}>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>}
          </button>

          {!sidebarCollapsed && user && (
            <button className="sidebar-item" onClick={() => setActiveView('settings')}>
              <User size={18} className="sidebar-item-icon" />
              <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.displayName || user.email}
              </span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
