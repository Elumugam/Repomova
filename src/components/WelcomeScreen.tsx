/* ============================================
   Welcome / Home Screen
   ============================================ */
import { Plus, LayoutGrid, ArrowRight, Clock, Folder } from 'lucide-react';
import { useWorkspaceStore } from '../store';
import { APP_STATUS_LABELS, APP_STATUS_COLORS, RUNTIME_LABELS } from '../types';

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never opened';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function WelcomeScreen() {
  const { connectedApps, setConnectModalOpen, setActiveView, openTab } = useWorkspaceStore();

  const recentApps = [...connectedApps]
    .sort((a, b) => {
      const aTime = a.lastOpened ? new Date(a.lastOpened).getTime() : 0;
      const bTime = b.lastOpened ? new Date(b.lastOpened).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 5);

  const runningApps = connectedApps.filter((a) => a.status === 'running');

  function handleOpenApp(app: typeof connectedApps[0]) {
    openTab({
      id: `tab-${app.id}`,
      appId: app.id,
      title: app.repoName,
      status: app.status,
    });
  }

  return (
    <div className="welcome-container">
      {/* Logo and welcome */}
      <img
        src="/repomova-icon.png"
        alt="Repomova"
        className="welcome-logo"
      />
      <h1 className="welcome-title">Welcome to Repomova</h1>
      <p className="welcome-subtitle">
        Every repository. One workspace.
      </p>

      {/* Actions */}
      <div className="welcome-actions">
        <button
          className="btn btn-primary btn-lg"
          onClick={() => setConnectModalOpen(true)}
        >
          <Plus size={18} />
          Connect Repository
        </button>
        {connectedApps.length > 0 && (
          <button
            className="btn btn-secondary btn-lg"
            onClick={() => setActiveView('apps')}
          >
            <LayoutGrid size={18} />
            Open Recent App
          </button>
        )}
      </div>

      {/* Running Apps */}
      {runningApps.length > 0 && (
        <div className="welcome-section">
          <div className="welcome-section-title">Running Applications</div>
          {runningApps.map((app) => (
            <div
              key={app.id}
              className="app-row"
              onClick={() => handleOpenApp(app)}
            >
              <div className="app-row-icon">
                <Folder size={18} />
              </div>
              <div className="app-row-info">
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
                </div>
              </div>
              <div className="app-row-actions" style={{ opacity: 1 }}>
                <button className="btn btn-ghost btn-sm">
                  <ArrowRight size={14} />
                  Open
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Apps */}
      {recentApps.length > 0 && (
        <div className="welcome-section">
          <div className="welcome-section-title">Recent Applications</div>
          {recentApps.map((app) => (
            <div
              key={app.id}
              className="app-row"
              onClick={() => handleOpenApp(app)}
            >
              <div className="app-row-icon">
                <Folder size={18} />
              </div>
              <div className="app-row-info">
                <div className="app-row-name">{app.repoName}</div>
                <div className="app-row-meta">
                  <span>{app.repoOwner}</span>
                  <span>·</span>
                  <span>{RUNTIME_LABELS[app.runtimeType]}</span>
                  <span>·</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={10} />
                    {formatTimeAgo(app.lastOpened)}
                  </span>
                </div>
              </div>
              <div className="app-row-actions">
                <button className="btn btn-ghost btn-sm">
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {connectedApps.length === 0 && (
        <div className="welcome-section" style={{ textAlign: 'center' }}>
          <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
            <LayoutGrid size={40} className="empty-state-icon" />
            <div className="empty-state-title">No connected applications</div>
            <div className="empty-state-description">
              Connect a GitHub repository to get started. Repomova will detect the project type, 
              install dependencies, and launch it as a running application you can use right here.
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setConnectModalOpen(true)}
            >
              <Plus size={16} />
              Connect Your First Repository
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
