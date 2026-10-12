/* ============================================
   Overview / Home Dashboard Screen
   ============================================ */
import { useState, useEffect, useRef } from 'react';
import {
  LayoutGrid,
  ArrowRight,
  Clock,
  Folder,
  Play,
  Square,
  AlertCircle,
  GitBranch,
  CheckCircle,
  Settings,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { useWorkspaceStore } from '../store';
import { APP_STATUS_LABELS, APP_STATUS_COLORS, RUNTIME_LABELS } from '../types';
import type { ConnectedApp } from '../types';

interface WelcomeScreenProps {
  isLoading?: boolean;
  error?: string | null;
}

interface ActivityEvent {
  id: string;
  type: 'connected' | 'cloned' | 'started' | 'stopped' | 'failed' | 'opened';
  description: string;
  appName: string;
  timestamp: string;
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never opened';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return 'Just now';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function WelcomeScreen({ isLoading: propLoading, error: propError }: WelcomeScreenProps = {}) {
  const {
    connectedApps,
    setActiveView,
    openTab,
    updateAppStatus,
    removeConnectedApp,
    appsLoading,
    appsError,
  } = useWorkspaceStore();

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close contextual menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    }
    if (activeMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activeMenuId]);

  const isLoading = propLoading ?? appsLoading;
  const error = propError ?? appsError;

  // Workspace Statistics
  const totalApps = connectedApps.length;
  const runningApps = connectedApps.filter((a) => a.status === 'running');
  const runningCount = runningApps.length;
  const stoppedCount = connectedApps.filter((a) => a.status === 'stopped').length;
  const attentionCount = connectedApps.filter(
    (a) => a.status === 'failed' || a.status === 'requires_configuration' || a.status === 'unsupported'
  ).length;

  // Connected Applications (up to 5 recent/relevant apps)
  const displayApps = [...connectedApps]
    .sort((a, b) => {
      const aTime = a.lastOpened
        ? new Date(a.lastOpened).getTime()
        : new Date(a.updatedAt || a.createdAt).getTime();
      const bTime = b.lastOpened
        ? new Date(b.lastOpened).getTime()
        : new Date(b.updatedAt || b.createdAt).getTime();
      return bTime - aTime;
    })
    .slice(0, 5);

  // Derive actual recorded events from existing applications
  const recordedEvents: ActivityEvent[] = [];
  connectedApps.forEach((app) => {
    if (app.createdAt) {
      recordedEvents.push({
        id: `${app.id}-created`,
        type: 'connected',
        description: 'Repository connected',
        appName: app.repoName,
        timestamp: app.createdAt,
      });
    }
    if (app.cloneStatus === 'cloned') {
      recordedEvents.push({
        id: `${app.id}-cloned`,
        type: 'cloned',
        description: 'Clone completed',
        appName: app.repoName,
        timestamp: app.updatedAt || app.createdAt,
      });
    }
    if (app.status === 'running') {
      recordedEvents.push({
        id: `${app.id}-running`,
        type: 'started',
        description: 'Application started',
        appName: app.repoName,
        timestamp: app.updatedAt || app.lastOpened || app.createdAt,
      });
    } else if (app.status === 'stopped') {
      recordedEvents.push({
        id: `${app.id}-stopped`,
        type: 'stopped',
        description: 'Application stopped',
        appName: app.repoName,
        timestamp: app.updatedAt || app.createdAt,
      });
    } else if (app.status === 'failed') {
      recordedEvents.push({
        id: `${app.id}-failed`,
        type: 'failed',
        description: 'Application failed to start',
        appName: app.repoName,
        timestamp: app.updatedAt || app.createdAt,
      });
    }
    if (app.lastOpened && app.lastOpened !== app.createdAt) {
      recordedEvents.push({
        id: `${app.id}-opened`,
        type: 'opened',
        description: 'Application opened',
        appName: app.repoName,
        timestamp: app.lastOpened,
      });
    }
  });

  const recentEvents = recordedEvents
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  function handleOpenApp(app: ConnectedApp) {
    openTab({
      id: `tab-${app.id}`,
      appId: app.id,
      title: app.repoName,
      status: app.status,
    });
  }

  function handleStartApp(app: ConnectedApp) {
    updateAppStatus(app.id, 'starting');
    setTimeout(() => updateAppStatus(app.id, 'running'), 2000);
    setActiveMenuId(null);
  }

  function handleStopApp(app: ConnectedApp) {
    updateAppStatus(app.id, 'stopped');
    setActiveMenuId(null);
  }

  function handleDisconnectApp(app: ConnectedApp) {
    if (confirm(`Disconnect "${app.repoName}"? This will remove it from your workspace.`)) {
      removeConnectedApp(app.id);
    }
    setActiveMenuId(null);
  }

  function handleQuickOpenRunning() {
    if (runningApps.length > 0) {
      handleOpenApp(runningApps[0]);
    } else {
      setActiveView('apps');
    }
  }

  function handleQuickOpenRecent() {
    const recentWithOpened = connectedApps.find((a) => a.lastOpened);
    if (recentWithOpened) {
      handleOpenApp(recentWithOpened);
    } else if (connectedApps.length > 0) {
      handleOpenApp(connectedApps[0]);
    } else {
      setActiveView('apps');
    }
  }

  function renderActivityIcon(type: ActivityEvent['type']) {
    switch (type) {
      case 'connected':
        return <GitBranch size={13} />;
      case 'cloned':
        return <CheckCircle size={13} />;
      case 'started':
        return <Play size={13} />;
      case 'stopped':
        return <Square size={13} />;
      case 'failed':
        return <AlertCircle size={13} />;
      case 'opened':
      default:
        return <Clock size={13} />;
    }
  }

  return (
    <div className="dashboard-container" data-testid="dashboard-container">
      {/* Page Header */}
      <div className="dashboard-header">
        <h1 className="dashboard-title">Overview</h1>
        <p className="dashboard-subtitle">Your workspace at a glance.</p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="dashboard-state-message" role="status" aria-busy="true">
          <span>Loading workspace data...</span>
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div className="dashboard-state-message" role="alert" style={{ color: 'var(--color-error)' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Workspace Statistics */}
      {!isLoading && !error && (
        <div className="dashboard-stats" aria-label="Workspace Statistics">
          <div className="stat-item">
            <span className="stat-value" data-testid="stat-total">{totalApps}</span>
            <span className="stat-label">Total Connected</span>
          </div>
          <div className="stat-separator" />
          <div className="stat-item">
            <span className="stat-value" data-testid="stat-running">{runningCount}</span>
            <span className="stat-label">Running</span>
          </div>
          <div className="stat-separator" />
          <div className="stat-item">
            <span className="stat-value" data-testid="stat-stopped">{stoppedCount}</span>
            <span className="stat-label">Stopped</span>
          </div>
          <div className="stat-separator" />
          <div className="stat-item">
            <span className="stat-value" data-testid="stat-attention">{attentionCount}</span>
            <span className="stat-label">Needs Attention</span>
          </div>
        </div>
      )}

      {/* Main Dashboard Layout */}
      {!isLoading && !error && (
        <div className="dashboard-grid">
          {/* Main Column: Connected Applications */}
          <div className="dashboard-main-col">
            <section className="dashboard-section" aria-labelledby="connected-apps-heading">
              <div className="dashboard-section-header">
                <h2 id="connected-apps-heading" className="dashboard-section-title">Connected Applications</h2>
                {connectedApps.length > 0 && (
                  <button
                    className="dashboard-link"
                    onClick={() => setActiveView('apps')}
                    aria-label="View all connected applications"
                  >
                    View all
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>

              {displayApps.length > 0 ? (
                <div className="dashboard-app-list">
                  {displayApps.map((app) => (
                    <div
                      key={app.id}
                      className="dashboard-app-row"
                      data-testid={`app-row-${app.id}`}
                    >
                      <div
                        className="dashboard-app-info"
                        onClick={() => handleOpenApp(app)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleOpenApp(app);
                          }
                        }}
                      >
                        <div className="dashboard-app-icon">
                          <Folder size={16} />
                        </div>
                        <div className="dashboard-app-details">
                          <div className="dashboard-app-name">{app.repoName}</div>
                          <div className="dashboard-app-meta">
                            <span>{app.repoOwner}/{app.repoName}</span>
                            <span>·</span>
                            <span>{RUNTIME_LABELS[app.runtimeType] || app.runtimeType}</span>
                            <span>·</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span
                                className="status-dot"
                                style={{ background: APP_STATUS_COLORS[app.status] }}
                              />
                              {APP_STATUS_LABELS[app.status]}
                            </span>
                            {(app.lastOpened || app.updatedAt) && (
                              <>
                                <span>·</span>
                                <span>{formatTimeAgo(app.lastOpened || app.updatedAt)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="dashboard-app-actions">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleOpenApp(app)}
                          title={`Open ${app.repoName}`}
                          aria-label={`Open ${app.repoName}`}
                        >
                          Open
                        </button>

                        <div style={{ position: 'relative' }} ref={activeMenuId === app.id ? menuRef : null}>
                          <button
                            className="btn btn-icon btn-ghost btn-sm"
                            onClick={() => setActiveMenuId(activeMenuId === app.id ? null : app.id)}
                            title="More options"
                            aria-label={`More options for ${app.repoName}`}
                            aria-haspopup="true"
                            aria-expanded={activeMenuId === app.id}
                          >
                            <MoreHorizontal size={14} />
                          </button>

                          {activeMenuId === app.id && (
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
                              {app.status === 'running' ? (
                                <button
                                  className="sidebar-item"
                                  style={{ width: '100%' }}
                                  onClick={() => handleStopApp(app)}
                                >
                                  <Square size={14} />
                                  <span>Stop</span>
                                </button>
                              ) : (
                                <button
                                  className="sidebar-item"
                                  style={{ width: '100%' }}
                                  onClick={() => handleStartApp(app)}
                                >
                                  <Play size={14} />
                                  <span>Start</span>
                                </button>
                              )}
                              <button
                                className="sidebar-item"
                                style={{ width: '100%', color: 'var(--color-error)' }}
                                onClick={() => handleDisconnectApp(app)}
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
              ) : (
                <div className="dashboard-empty">
                  <div className="dashboard-empty-title">No connected applications yet</div>
                  <div className="dashboard-empty-desc">
                    Your connected applications will appear here once you add a repository.
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Secondary Column: Quick Access & Recent Activity */}
          <div className="dashboard-side-col">
            {/* Quick Access */}
            <section className="dashboard-section" aria-labelledby="quick-access-heading">
              <div className="dashboard-section-header">
                <h2 id="quick-access-heading" className="dashboard-section-title">Quick Access</h2>
              </div>
              <div className="quick-access-list">
                <button
                  className="quick-access-item"
                  onClick={() => setActiveView('apps')}
                >
                  <div className="quick-access-left">
                    <LayoutGrid size={15} />
                    <span>All connected applications</span>
                  </div>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    {totalApps}
                  </span>
                </button>

                <button
                  className="quick-access-item"
                  onClick={handleQuickOpenRunning}
                >
                  <div className="quick-access-left">
                    <Play size={15} />
                    <span>Running applications</span>
                  </div>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    {runningCount}
                  </span>
                </button>

                <button
                  className="quick-access-item"
                  onClick={handleQuickOpenRecent}
                >
                  <div className="quick-access-left">
                    <Clock size={15} />
                    <span>Recently opened applications</span>
                  </div>
                </button>

                <button
                  className="quick-access-item"
                  onClick={() => setActiveView('settings')}
                >
                  <div className="quick-access-left">
                    <Settings size={15} />
                    <span>Settings</span>
                  </div>
                </button>
              </div>
            </section>

            {/* Recent Activity */}
            <section className="dashboard-section" aria-labelledby="recent-activity-heading">
              <div className="dashboard-section-header">
                <h2 id="recent-activity-heading" className="dashboard-section-title">Recent Activity</h2>
              </div>

              {recentEvents.length > 0 ? (
                <div className="activity-list">
                  {recentEvents.map((event) => (
                    <div key={event.id} className="activity-item">
                      <div className="activity-icon">
                        {renderActivityIcon(event.type)}
                      </div>
                      <div className="activity-content">
                        <div className="activity-header">
                          <span className="activity-desc">{event.description}</span>
                          <span className="activity-time">{formatTimeAgo(event.timestamp)}</span>
                        </div>
                        <div className="activity-app">{event.appName}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="dashboard-empty">
                  <div className="dashboard-empty-title">No recent activity</div>
                  <div className="dashboard-empty-desc">
                    Activity events will appear here as applications are connected and run.
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
