/* ============================================
   Connected Apps View — Modern Responsive Grid Layout
   ============================================ */
import { useState } from 'react';
import {
  Search,
  Play,
  Square,
  Trash2,
  MoreHorizontal,
  ArrowRight,
  Plus,
  Filter,
  Bookmark,
  Settings,
  Edit3,
  Maximize2,
  Server,
  Terminal,
  Package,
  Code2,
  Globe,
  Layers,
} from 'lucide-react';
import { useWorkspaceStore } from '../store';
import {
  APP_STATUS_LABELS,
  APP_STATUS_COLORS,
  RUNTIME_LABELS,
  isFrontendRuntime,
} from '../types';
import type { ConnectedApp, AppStatus } from '../types';
import { EditAppModal } from './EditAppModal';
import { ConfigModal } from './ConfigModal';

function DefaultThumbnail({ app }: { app: ConnectedApp }) {
  const isWeb = isFrontendRuntime(app.runtimeType);
  const runtimeLabel = RUNTIME_LABELS[app.runtimeType] || 'App';

  const getIcon = () => {
    switch (app.runtimeType) {
      case 'backend':
        return <Server size={26} />;
      case 'cli':
        return <Terminal size={26} />;
      case 'library':
        return <Package size={26} />;
      case 'static':
        return <Globe size={26} />;
      default:
        return isWeb ? <Code2 size={26} /> : <Layers size={26} />;
    }
  };

  return (
    <div className="app-card-default-thumb">
      <div className="app-card-default-thumb-icon-wrap">
        {getIcon()}
      </div>
      <span className="app-card-default-thumb-badge">
        {runtimeLabel}
      </span>
    </div>
  );
}

export function ConnectedAppsView() {
  const {
    connectedApps,
    setConnectModalOpen,
    openTabs,
    openTab,
    openNewWindow,
    setActiveTab,
    removeConnectedApp,
    updateAppStatus,
    isBookmarked,
    toggleBookmark,
  } = useWorkspaceStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AppStatus | 'all'>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editApp, setEditApp] = useState<ConnectedApp | null>(null);
  const [configApp, setConfigApp] = useState<ConnectedApp | null>(null);

  const filteredApps = connectedApps.filter((app) => {
    const q = searchQuery.toLowerCase().trim();
    const appName = (app.displayName || app.repoName).toLowerCase();
    const repoName = app.repoName.toLowerCase();
    const owner = app.repoOwner.toLowerCase();
    const fullName = app.repoFullName.toLowerCase();
    const desc = (app.description || '').toLowerCase();

    const matchesSearch =
      !q ||
      appName.includes(q) ||
      repoName.includes(q) ||
      owner.includes(q) ||
      fullName.includes(q) ||
      desc.includes(q);

    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  function handleOpenApp(app: ConnectedApp) {
    const existing = openTabs.find((t) => t.appId === app.id);
    if (existing) {
      setActiveTab(existing.id);
    } else {
      openTab({
        id: `tab-${app.id}`,
        appId: app.id,
        title: app.displayName || app.repoName,
        status: app.status,
      });
    }
  }

  function handleOpenNewWindow(app: ConnectedApp) {
    openNewWindow(app.id);
  }

  function handleOpenFullscreen(app: ConnectedApp) {
    handleOpenApp(app);
    // Notify running view to open full-screen workspace view immediately
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('repomova-enter-fullscreen', { detail: { appId: app.id } })
      );
    }, 100);
  }

  function handleStopApp(app: ConnectedApp) {
    updateAppStatus(app.id, 'stopped');
  }

  function handleStartApp(app: ConnectedApp) {
    handleOpenApp(app);
  }

  function handleDisconnect(app: ConnectedApp) {
    const appName = app.displayName || app.repoName;
    if (confirm(`Disconnect "${appName}"? This will remove it from your workspace.`)) {
      removeConnectedApp(app.id);
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return (
    <div className="connected-apps-container">
      {/* Header */}
      <div className="connected-apps-header">
        <div>
          <h1 className="connected-apps-title">
            Connected Applications
          </h1>
          <p className="connected-apps-subtitle">
            {connectedApps.length} {connectedApps.length === 1 ? 'repository' : 'repositories'} connected
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setConnectModalOpen(true)}
          id="connect-repo-btn"
        >
          <Plus size={16} />
          <span>Connect Repository</span>
        </button>
      </div>

      {/* Search and Filter */}
      {connectedApps.length > 0 && (
        <div className="connected-apps-filter-bar">
          <div className="connected-apps-search-wrap">
            <Search
              size={16}
              className="connected-apps-search-icon"
            />
            <input
              className="input-field connected-apps-search-input"
              placeholder="Search applications by name, repo, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search connected applications"
            />
          </div>
          <select
            className="input-field connected-apps-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AppStatus | 'all')}
            aria-label="Filter applications by status"
          >
            <option value="all">All statuses</option>
            <option value="running">Running</option>
            <option value="stopped">Stopped</option>
            <option value="connected">Connected</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      )}

      {/* Grid of Connected Applications */}
      {filteredApps.length > 0 ? (
        <div className="connected-apps-grid" data-testid="connected-apps-grid">
          {filteredApps.map((app) => {
            const displayName = app.displayName || app.repoName;
            const bookmarked = isBookmarked(app.id);
            const isMenuOpen = menuOpenId === app.id;

            return (
              <div
                key={app.id}
                className="app-card"
                data-testid={`app-card-${app.id}`}
              >
                {/* Thumbnail Header Area */}
                <div
                  className="app-card-thumb"
                  onClick={() => handleOpenApp(app)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenApp(app);
                    }
                  }}
                  title={`Open ${displayName}`}
                >
                  {app.customThumbnail ? (
                    <img
                      src={app.customThumbnail}
                      alt={displayName}
                      className="app-card-thumb-img"
                    />
                  ) : (
                    <DefaultThumbnail app={app} />
                  )}

                  {/* Overlays on Thumbnail */}
                  <div className="app-card-thumb-top">
                    {/* Running / Stopped status badge */}
                    <span className="app-card-status-badge">
                      <span
                        className="status-dot"
                        style={{ background: APP_STATUS_COLORS[app.status] }}
                      />
                      <span>{APP_STATUS_LABELS[app.status]}</span>
                    </span>

                    {/* Bookmark action */}
                    <button
                      type="button"
                      className={`app-card-bookmark-btn ${bookmarked ? 'bookmarked' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBookmark(app.id);
                      }}
                      title={bookmarked ? `Unbookmark ${displayName}` : `Bookmark ${displayName}`}
                      aria-label={bookmarked ? `Unbookmark ${displayName}` : `Bookmark ${displayName}`}
                    >
                      <Bookmark
                        size={14}
                        fill={bookmarked ? 'currentColor' : 'none'}
                      />
                    </button>
                  </div>

                  {/* Hover action indicator */}
                  <div className="app-card-thumb-overlay">
                    <span className="app-card-thumb-overlay-action">
                      {app.status === 'running' ? 'Open Workspace' : 'Launch Application'}
                    </span>
                  </div>
                </div>

                {/* Card Body Information */}
                <div
                  className="app-card-body"
                  onClick={() => handleOpenApp(app)}
                >
                  <div className="app-card-title-row">
                    <h2 className="app-card-title" title={displayName}>
                      {displayName}
                    </h2>
                    {app.displayName && app.displayName !== app.repoName && (
                      <span className="app-card-original-name" title={`Repository: ${app.repoFullName}`}>
                        ({app.repoName})
                      </span>
                    )}
                  </div>

                  <div className="app-card-repo-meta">
                    <span className="app-card-repo-slug" title={app.repoFullName}>
                      {app.repoFullName}
                    </span>
                    {app.port && app.status === 'running' && (
                      <span className="app-card-port-pill">:{app.port}</span>
                    )}
                  </div>

                  {app.description && (
                    <p className="app-card-description" title={app.description}>
                      {app.description}
                    </p>
                  )}

                  <div className="app-card-meta-chips">
                    <span className="badge app-card-runtime-chip">
                      {RUNTIME_LABELS[app.runtimeType]}
                    </span>
                    {app.lastOpened && (
                      <span className="app-card-date-chip">
                        Opened {formatDate(app.lastOpened)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Controls Footer */}
                <div className="app-card-actions">
                  {app.status === 'running' ? (
                    <button
                      className="btn btn-ghost btn-sm app-card-action-btn"
                      onClick={() => handleStopApp(app)}
                      title={`Stop ${displayName}`}
                      aria-label={`Stop ${displayName}`}
                    >
                      <Square size={14} />
                      <span>Stop</span>
                    </button>
                  ) : (
                    <button
                      className="btn btn-ghost btn-sm app-card-action-btn"
                      onClick={() => handleStartApp(app)}
                      title={`Launch ${displayName}`}
                      aria-label={`Launch ${displayName}`}
                    >
                      <Play size={14} />
                      <span>Launch</span>
                    </button>
                  )}

                  <button
                    className="btn btn-ghost btn-sm app-card-action-btn"
                    onClick={() => handleOpenApp(app)}
                    title={`Open ${displayName} in workspace`}
                    aria-label={`Open ${displayName}`}
                  >
                    <ArrowRight size={14} />
                    <span>Open</span>
                  </button>

                  <button
                    className="btn btn-icon btn-ghost btn-sm"
                    onClick={() => setConfigApp(app)}
                    title="Configure repository"
                    aria-label={`Configure ${displayName}`}
                  >
                    <Settings size={14} />
                  </button>

                  <button
                    className="btn btn-icon btn-ghost btn-sm"
                    onClick={() => setEditApp(app)}
                    title="Edit display name & thumbnail"
                    aria-label={`Edit ${displayName}`}
                  >
                    <Edit3 size={14} />
                  </button>

                  {/* Dropdown Menu for Extra Actions */}
                  <div style={{ position: 'relative' }}>
                    <button
                      className="btn btn-icon btn-ghost btn-sm"
                      onClick={() => setMenuOpenId(isMenuOpen ? null : app.id)}
                      title="More options"
                      aria-label={`More options for ${displayName}`}
                    >
                      <MoreHorizontal size={14} />
                    </button>

                    {isMenuOpen && (
                      <div className="app-card-dropdown-menu">
                        <button
                          className="sidebar-item"
                          style={{ width: '100%', fontSize: 'var(--font-size-xs)' }}
                          onClick={() => {
                            handleOpenNewWindow(app);
                            setMenuOpenId(null);
                          }}
                        >
                          <Plus size={13} />
                          <span>Open New Window</span>
                        </button>
                        <button
                          className="sidebar-item"
                          style={{ width: '100%', fontSize: 'var(--font-size-xs)' }}
                          onClick={() => {
                            handleOpenFullscreen(app);
                            setMenuOpenId(null);
                          }}
                        >
                          <Maximize2 size={13} />
                          <span>Open Full Screen</span>
                        </button>
                        <button
                          className="sidebar-item"
                          style={{ width: '100%', fontSize: 'var(--font-size-xs)', color: 'var(--color-error)' }}
                          onClick={() => {
                            handleDisconnect(app);
                            setMenuOpenId(null);
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Disconnect</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : connectedApps.length === 0 ? (
        <div className="empty-state">
          <div className="app-row-icon" style={{ width: '56px', height: '56px', marginBottom: 'var(--space-4)' }}>
            <Layers size={28} />
          </div>
          <h2 className="empty-state-title">No connected applications yet</h2>
          <p className="empty-state-description">
            Connect a GitHub repository to get started. Repomova will detect, build, and run your application in the workspace.
          </p>
          <button className="btn btn-primary" onClick={() => setConnectModalOpen(true)}>
            <Plus size={16} />
            <span>Connect Repository</span>
          </button>
        </div>
      ) : (
        <div className="empty-state">
          <Filter size={48} className="empty-state-icon" />
          <h2 className="empty-state-title">No applications found</h2>
          <p className="empty-state-description">
            No connected applications match &ldquo;{searchQuery}&rdquo; or the selected status filter.
          </p>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Edit App Modal for Name & Thumbnail */}
      {editApp && (
        <EditAppModal
          key={editApp.id}
          app={editApp}
          isOpen={Boolean(editApp)}
          onClose={() => setEditApp(null)}
        />
      )}

      {/* Configuration Modal */}
      {configApp && (
        <ConfigModal
          app={configApp}
          isOpen={Boolean(configApp)}
          onClose={() => setConfigApp(null)}
        />
      )}
    </div>
  );
}
