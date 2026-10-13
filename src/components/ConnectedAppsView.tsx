/* ============================================
   Connected Apps View
   ============================================ */
import { useState } from 'react';
import {
  Search,
  Folder,
  Play,
  Square,
  Trash2,
  MoreHorizontal,
  ArrowRight,
  Plus,
  Filter,
} from 'lucide-react';
import { useWorkspaceStore } from '../store';
import { APP_STATUS_LABELS, APP_STATUS_COLORS, RUNTIME_LABELS } from '../types';
import type { ConnectedApp, AppStatus } from '../types';

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
  } = useWorkspaceStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AppStatus | 'all'>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const filteredApps = connectedApps.filter((app) => {
    const matchesSearch =
      app.repoName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.repoOwner.toLowerCase().includes(searchQuery.toLowerCase());
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
        title: app.repoName,
        status: app.status,
      });
    }
  }

  function handleOpenNewWindow(app: ConnectedApp) {
    openNewWindow(app.id);
  }

  function handleStopApp(app: ConnectedApp) {
    updateAppStatus(app.id, 'stopped');
  }

  function handleStartApp(app: ConnectedApp) {
    handleOpenApp(app);
  }

  function handleDisconnect(app: ConnectedApp) {
    if (confirm(`Disconnect "${app.repoName}"? This will remove it from your workspace.`)) {
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
    <div style={{ padding: 'var(--space-6)', maxWidth: 'var(--content-max-width)', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-semibold)',
            letterSpacing: 'var(--letter-spacing-tight)',
          }}>
            Connected Applications
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>
            {connectedApps.length} {connectedApps.length === 1 ? 'repository' : 'repositories'} connected
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setConnectModalOpen(true)}>
          <Plus size={16} />
          Connect Repository
        </button>
      </div>

      {/* Search and Filter */}
      {connectedApps.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: 'var(--space-3)',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)',
              }}
            />
            <input
              className="input-field"
              placeholder="Search applications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 'var(--space-10)' }}
            />
          </div>
          <select
            className="input-field"
            style={{ width: '160px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AppStatus | 'all')}
          >
            <option value="all">All statuses</option>
            <option value="running">Running</option>
            <option value="stopped">Stopped</option>
            <option value="connected">Connected</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      )}

      {/* App list */}
      {filteredApps.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filteredApps.map((app) => (
            <div
              key={app.id}
              className="app-row"
              style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
            >
              <div className="app-row-icon">
                <Folder size={18} />
              </div>
              <div className="app-row-info" style={{ cursor: 'pointer' }} onClick={() => handleOpenApp(app)}>
                <div className="app-row-name">{app.repoName}</div>
                <div className="app-row-meta">
                  <span>{app.repoOwner}</span>
                  <span>·</span>
                  <span>{RUNTIME_LABELS[app.runtimeType]}</span>
                  <span>·</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="status-dot" style={{ background: APP_STATUS_COLORS[app.status] }} />
                    {APP_STATUS_LABELS[app.status]}
                  </span>
                  {app.lastOpened && (
                    <>
                      <span>·</span>
                      <span>Opened {formatDate(app.lastOpened)}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="app-row-actions">
                {app.status === 'running' ? (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleStopApp(app)}
                    title="Stop"
                  >
                    <Square size={14} />
                  </button>
                ) : app.status === 'stopped' || app.status === 'connected' ? (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleStartApp(app)}
                    title="Start"
                  >
                    <Play size={14} />
                  </button>
                ) : null}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleOpenApp(app)}
                  title="Open"
                >
                  <ArrowRight size={14} />
                </button>
                <div style={{ position: 'relative' }}>
                  <button
                    className="btn btn-icon btn-ghost btn-sm"
                    onClick={() => setMenuOpenId(menuOpenId === app.id ? null : app.id)}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {menuOpenId === app.id && (
                    <div
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: '100%',
                        background: 'var(--color-bg-elevated)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-1)',
                        minWidth: '160px',
                        zIndex: 'var(--z-dropdown)',
                        boxShadow: 'var(--shadow-lg)',
                      }}
                    >
                      <button
                        className="sidebar-item"
                        style={{ width: '100%' }}
                        onClick={() => {
                          handleOpenNewWindow(app);
                          setMenuOpenId(null);
                        }}
                      >
                        <Plus size={14} />
                        <span>Open New Window</span>
                      </button>
                      <button
                        className="sidebar-item"
                        style={{ width: '100%', color: 'var(--color-error)' }}
                        onClick={() => {
                          handleDisconnect(app);
                          setMenuOpenId(null);
                        }}
                      >
                        <Trash2 size={14} />
                        <span>Disconnect</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : connectedApps.length === 0 ? (
        <div className="empty-state">
          <Folder size={48} className="empty-state-icon" />
          <div className="empty-state-title">No connected applications yet</div>
          <div className="empty-state-description">
            Connect a GitHub repository to get started. Repomova will detect, build, and run your application.
          </div>
          <button className="btn btn-primary" onClick={() => setConnectModalOpen(true)}>
            <Plus size={16} />
            Connect Repository
          </button>
        </div>
      ) : (
        <div className="empty-state">
          <Filter size={48} className="empty-state-icon" />
          <div className="empty-state-title">No results</div>
          <div className="empty-state-description">
            No applications match your search or filter criteria.
          </div>
        </div>
      )}
    </div>
  );
}
