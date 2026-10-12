/* ============================================
   Topbar Component
   ============================================ */
import {
  Menu,
  Plus,
  RefreshCw,
  ExternalLink,
  X,
  LogIn,
} from 'lucide-react';
import { useWorkspaceStore } from '../store';

export function Topbar() {
  const {
    toggleSidebar,
    openTabs,
    activeTabId,
    setActiveTab,
    closeTab,
    setConnectModalOpen,
    isAuthenticated,
    setActiveView,
  } = useWorkspaceStore();

  const activeTab = openTabs.find((t) => t.id === activeTabId);

  return (
    <div className="app-topbar">
      {/* Left: menu + tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1, minWidth: 0 }}>
        <button
          className="btn btn-icon btn-ghost btn-sm"
          onClick={toggleSidebar}
          style={{ display: 'none' }}
          id="mobile-menu-btn"
        >
          <Menu size={18} />
        </button>

        {/* Tabs */}
        {openTabs.length > 0 && (
          <div className="tab-bar" style={{ border: 'none', background: 'transparent', height: 'auto', padding: 0 }}>
            {openTabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab-item ${tab.id === activeTabId ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="status-dot" style={{
                  background: tab.status === 'running'
                    ? 'var(--color-status-running)'
                    : 'var(--color-status-stopped)',
                  width: '6px', height: '6px',
                }} />
                <span>{tab.title}</span>
                <span
                  className="tab-close"
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                >
                  <X size={12} />
                </span>
              </button>
            ))}
          </div>
        )}

        {openTabs.length === 0 && (
          <span style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-tertiary)',
            fontWeight: 'var(--font-weight-medium)',
          }}>
            Repomova
          </span>
        )}
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
        {activeTab && (
          <>
            <button className="btn btn-icon btn-ghost btn-sm" title="Reload application">
              <RefreshCw size={14} />
            </button>
            <button className="btn btn-icon btn-ghost btn-sm" title="Open in new window">
              <ExternalLink size={14} />
            </button>
          </>
        )}

        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setConnectModalOpen(true)}
          style={{ gap: 'var(--space-1)' }}
        >
          <Plus size={14} />
          <span>Connect</span>
        </button>

        {!isAuthenticated && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setActiveView('settings')}
            style={{ gap: 'var(--space-1)' }}
          >
            <LogIn size={14} />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </div>
  );
}
