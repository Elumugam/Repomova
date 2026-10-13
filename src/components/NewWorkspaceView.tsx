/* ============================================
   New Workspace View — Empty workspace selection
   ============================================ */
import { Folder, Plus, ArrowRight } from 'lucide-react';
import { useWorkspaceStore } from '../store';
import { APP_STATUS_LABELS, APP_STATUS_COLORS, RUNTIME_LABELS } from '../types';

interface NewWorkspaceViewProps {
  tabId: string;
}

export function NewWorkspaceView({ tabId }: NewWorkspaceViewProps) {
  const { connectedApps, assignAppToTab, setConnectModalOpen } = useWorkspaceStore();

  return (
    <div style={{ padding: 'var(--space-8) var(--space-6)', maxWidth: 'var(--content-max-width)', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{
          fontSize: 'var(--font-size-xl)',
          fontWeight: 'var(--font-weight-semibold)',
          letterSpacing: 'var(--letter-spacing-tight)',
        }}>
          New Workspace
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>
          Select an already connected repository or connect a new GitHub repository to work in this workspace.
        </p>
      </div>

      {connectedApps.length > 0 ? (
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-3)',
            paddingBottom: 'var(--space-2)',
            borderBottom: '1px solid var(--color-border-subtle)',
          }}>
            <span style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--letter-spacing-wide)',
            }}>
              Connected Repositories ({connectedApps.length})
            </span>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setConnectModalOpen(true)}
              style={{ gap: 'var(--space-1)' }}
            >
              <Plus size={14} />
              <span>Connect New Repository</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {connectedApps.map((app) => (
              <div
                key={app.id}
                className="app-row"
                style={{
                  borderBottom: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 'var(--space-3) var(--space-2)',
                }}
              >
                <div className="app-row-icon" style={{ marginRight: 'var(--space-3)' }}>
                  <Folder size={18} />
                </div>
                <div
                  className="app-row-info"
                  style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                  onClick={() => assignAppToTab(tabId, app.id)}
                >
                  <div className="app-row-name" style={{ fontWeight: 'var(--font-weight-medium)' }}>
                    {app.repoName}
                  </div>
                  <div className="app-row-meta" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-tertiary)',
                  }}>
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
                <div className="app-row-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => assignAppToTab(tabId, app.id)}
                    aria-label={`Open ${app.repoName} in workspace`}
                    title={`Open ${app.repoName} in workspace`}
                    style={{ gap: 'var(--space-1)' }}
                  >
                    <span>Open in Workspace</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-state" style={{ padding: 'var(--space-12) 0', textAlign: 'center' }}>
          <Folder size={48} className="empty-state-icon" style={{ margin: '0 auto var(--space-3)', color: 'var(--color-text-muted)' }} />
          <div className="empty-state-title" style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>
            No connected repositories yet
          </div>
          <div className="empty-state-description" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', maxWidth: '420px', margin: '0 auto var(--space-4)' }}>
            Connect a GitHub repository to get started with this workspace. Repomova will automatically detect its runtime and configuration.
          </div>
          <button className="btn btn-primary" onClick={() => setConnectModalOpen(true)}>
            <Plus size={16} />
            <span>Connect Repository</span>
          </button>
        </div>
      )}
    </div>
  );
}
