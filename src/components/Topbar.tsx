/* ============================================
   Topbar Component
   ============================================ */
import { useState } from 'react';
import {
  Menu,
  Plus,
  RefreshCw,
  ExternalLink,
  X,
  LogIn,
  ChevronDown,
  Bookmark,
} from 'lucide-react';
import { useWorkspaceStore } from '../store';

export function Topbar() {
  const {
    toggleSidebar,
    openTabs,
    activeTabId,
    setActiveTab,
    closeTab,
    openNewWorkspace,
    openNewWindow,
    connectedApps,
    setConnectModalOpen,
    isAuthenticated,
    activeView,
    setActiveView,
    isBookmarked,
    toggleBookmark,
  } = useWorkspaceStore();

  const [windowMenuOpen, setWindowMenuOpen] = useState(false);
  const activeTab = openTabs.find((t) => t.id === activeTabId);
  const activeApp = activeTab ? connectedApps.find((a) => a.id === activeTab.appId) : null;

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

        {/* Tabs and '+' New Window Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', minWidth: 0, flex: 1 }}>
          {openTabs.length > 0 && (
            <div className="tab-bar" style={{ border: 'none', background: 'transparent', height: 'auto', padding: 0 }}>
              {openTabs.map((tab) => {
                const isTabActive = tab.id === activeTabId && activeView === 'apps';
                const tabApp = connectedApps.find((a) => a.id === tab.appId);
                const bookmarked = tabApp ? isBookmarked(tabApp.id) : false;

                return (
                  <button
                    key={tab.id}
                    className={`tab-item ${isTabActive ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setActiveView('apps');
                    }}
                    title={tab.title}
                  >
                    <span className="status-dot" style={{
                      background: tab.status === 'running'
                        ? 'var(--color-status-running)'
                        : tab.status === 'failed'
                        ? 'var(--color-status-error)'
                        : 'var(--color-status-stopped)',
                      width: '6px', height: '6px',
                    }} />
                    <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tab.title}
                    </span>

                    {/* Bookmark icon for connected app */}
                    {tabApp && (
                      <span
                        role="button"
                        tabIndex={0}
                        className={`tab-bookmark ${bookmarked ? 'bookmarked' : ''}`}
                        title={bookmarked ? `Unbookmark ${tabApp.repoName}` : `Bookmark ${tabApp.repoName}`}
                        aria-label={bookmarked ? `Unbookmark ${tabApp.repoName}` : `Bookmark ${tabApp.repoName}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBookmark(tabApp.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            toggleBookmark(tabApp.id);
                          }
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '2px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          marginLeft: '2px',
                          color: bookmarked ? 'var(--color-warning)' : 'var(--color-text-muted)',
                        }}
                      >
                        <Bookmark
                          size={11}
                          fill={bookmarked ? 'currentColor' : 'none'}
                        />
                      </span>
                    )}

                    <span
                      className="tab-close"
                      title="Close window"
                      aria-label={`Close ${tab.title}`}
                      onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                    >
                      <X size={12} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* '+' Button for opening new workspace */}
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <button
              className="btn btn-icon btn-ghost btn-sm tab-add-btn"
              title="Open new workspace"
              aria-label="Open new application window"
              onClick={() => openNewWorkspace()}
              style={{
                height: '28px',
                width: '28px',
                minWidth: '28px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Plus size={14} />
            </button>

            {connectedApps.length > 1 && (
              <>
                <button
                  className="btn btn-icon btn-ghost btn-sm"
                  title="Choose application to open in new window"
                  aria-label="Choose application to open in new window"
                  onClick={() => setWindowMenuOpen(!windowMenuOpen)}
                  style={{ height: '28px', width: '18px', padding: 0, marginLeft: '-2px' }}
                >
                  <ChevronDown size={11} />
                </button>

                {windowMenuOpen && (
                  <div
                    className="dropdown-menu"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: '4px',
                      background: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-md)',
                      padding: 'var(--space-1)',
                      minWidth: '200px',
                      zIndex: 'var(--z-dropdown)',
                    }}
                  >
                    <div style={{
                      padding: 'var(--space-1) var(--space-2)',
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-tertiary)',
                      fontWeight: 'var(--font-weight-medium)',
                      borderBottom: '1px solid var(--color-border-subtle)',
                      marginBottom: 'var(--space-1)',
                    }}>
                      Open New Window
                    </div>
                    <button
                      className="sidebar-item"
                      style={{ width: '100%', fontSize: 'var(--font-size-xs)', padding: 'var(--space-1) var(--space-2)' }}
                      onClick={() => {
                        openNewWorkspace();
                        setWindowMenuOpen(false);
                      }}
                    >
                      <Plus size={12} />
                      <span style={{ flex: 1, textAlign: 'left', fontWeight: 500 }}>
                        Empty Workspace
                      </span>
                    </button>
                    {connectedApps.map((app) => (
                      <button
                        key={app.id}
                        className="sidebar-item"
                        style={{ width: '100%', fontSize: 'var(--font-size-xs)', padding: 'var(--space-1) var(--space-2)' }}
                        onClick={() => {
                          openNewWindow(app.id);
                          setWindowMenuOpen(false);
                        }}
                      >
                        <span className="status-dot" style={{
                          background: app.status === 'running'
                            ? 'var(--color-status-running)'
                            : 'var(--color-status-stopped)',
                          width: '6px', height: '6px',
                        }} />
                        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {app.repoName}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>


          {openTabs.length === 0 && connectedApps.length === 0 && (
            <span style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-tertiary)',
              fontWeight: 'var(--font-weight-medium)',
            }}>
              Repomova
            </span>
          )}
        </div>
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
        {activeTab && (
          <>
            <button
              className="btn btn-icon btn-ghost btn-sm"
              title="Reload application"
              aria-label="Reload application"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('repomova-reload-preview', { detail: { appId: activeTab.appId } }));
              }}
            >
              <RefreshCw size={14} />
            </button>
            <button
              className="btn btn-icon btn-ghost btn-sm"
              title="Open in new browser window"
              aria-label="Open in new browser window"
              onClick={() => {
                const url = activeApp?.previewUrl || (activeApp?.port ? `http://127.0.0.1:${activeApp.port}` : '');
                if (url && url !== 'about:blank') {
                  window.open(url, '_blank');
                }
              }}
            >
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
