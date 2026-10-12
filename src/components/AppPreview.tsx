/* ============================================
   App Preview — Embedded application view
   ============================================ */
import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Play,
  Square,
  Settings,
  Check,
  Circle,
} from 'lucide-react';
import { useWorkspaceStore } from '../store';
import { APP_STATUS_LABELS, APP_STATUS_COLORS, RUNTIME_LABELS, LAUNCH_STAGE_LABELS } from '../types';
import type { ConnectedApp, LaunchStage, AppStatus } from '../types';
import { launchAppWithEvents, stopRunningApp, detectRepositoryFramework } from '../lib/launchService';
import { ConfigModal } from './ConfigModal';

interface AppPreviewProps {
  app: ConnectedApp;
}

export function AppPreview({ app }: AppPreviewProps) {
  const { updateAppStatus, updateApp } = useWorkspaceStore();
  const [launchStage, setLaunchStage] = useState<LaunchStage | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Auto-detect runtime if currently 'unknown' or unverified
  useEffect(() => {
    if (app.runtimeType === 'unknown' && app.repoUrl) {
      detectRepositoryFramework(app.id, app.repoUrl, app.repoName).then((res) => {
        if (res.runtimeType && res.runtimeType !== 'unknown') {
          updateApp(app.id, {
            runtimeType: res.runtimeType,
            detectionDetails: res.details,
            startCommand: res.startCommand,
            buildCommand: res.buildCommand,
            commandSources: res.commandSources,
            detectedEnvVars: res.detectedEnvVars,
          });
        }
      });
    }
  }, [app.id, app.repoUrl, app.repoName, app.runtimeType, updateApp]);

  const handleLaunch = useCallback(async () => {
    setIsLaunching(true);
    setErrorMessage(null);
    updateAppStatus(app.id, 'preparing');

    const mapStageToStatus = (stage: LaunchStage): AppStatus => {
      switch (stage) {
        case 'installing_deps': return 'installing_dependencies';
        case 'building': return 'building';
        case 'starting':
        case 'health_check': return 'starting';
        default: return 'preparing';
      }
    };

    try {
      // Connect to real-time SSE stream pushing launch stages
      const result = await launchAppWithEvents(app, (stage) => {
        setLaunchStage(stage);
        updateAppStatus(app.id, mapStageToStatus(stage));
      });

      // ONLY set to 'running' after the HTTP health check on the app's actual port succeeds!
      updateApp(app.id, {
        status: 'running',
        port: result.port,
        previewUrl: result.previewUrl,
        runtimeType: result.runtimeType,
        startCommand: result.startCommand,
        buildCommand: result.buildCommand,
        commandSources: result.commandSources,
        detectedEnvVars: result.detectedEnvVars,
      });
      setIsLaunching(false);
      setLaunchStage(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to launch application';
      setErrorMessage(msg);
      updateAppStatus(app.id, 'failed');
      setIsLaunching(false);
      setLaunchStage(null);
    }
  }, [app, updateApp, updateAppStatus]);

  return (
    <>
      {/* Determine view by app status */}
      {app.status === 'running' && app.repoUrl ? (
        <RunningAppView app={app} onOpenConfig={() => setIsConfigOpen(true)} />
      ) : app.status === 'failed' ? (
        <FailedView
          app={app}
          errorMessage={errorMessage}
          onRetry={handleLaunch}
          onOpenConfig={() => setIsConfigOpen(true)}
        />
      ) : isLaunching || ['preparing', 'installing_dependencies', 'building', 'starting'].includes(app.status) ? (
        <LaunchProgressView app={app} stage={launchStage} />
      ) : app.status === 'requires_configuration' ? (
        <ConfigRequiredView app={app} onOpenConfig={() => setIsConfigOpen(true)} />
      ) : (
        <ReadyToLaunchView
          app={app}
          onLaunch={handleLaunch}
          onOpenConfig={() => setIsConfigOpen(true)}
        />
      )}

      {/* Configuration Wizard Modal */}
      <ConfigModal
        app={app}
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onResumeLaunch={handleLaunch}
      />
    </>
  );
}

function ReadyToLaunchView({
  app,
  onLaunch,
  onOpenConfig,
}: {
  app: ConnectedApp;
  onLaunch: () => void;
  onOpenConfig: () => void;
}) {
  return (
    <div className="preview-loading">
      <div className="app-row-icon" style={{ width: '64px', height: '64px', borderRadius: 'var(--radius-lg)' }}>
        <Circle size={28} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-semibold)',
          marginBottom: 'var(--space-1)',
        }}>
          {app.repoName}
        </div>
        <div style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-tertiary)',
          marginBottom: 'var(--space-1)',
        }}>
          {app.repoOwner}/{app.repoName}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', justifyContent: 'center' }}>
          <span className="badge" style={{ background: 'var(--color-bg-tertiary)' }}>
            {RUNTIME_LABELS[app.runtimeType]}
          </span>
          <span className="badge" style={{
            background: 'var(--color-bg-tertiary)',
            display: 'flex', alignItems: 'center', gap: '4px',
          }}>
            <span className="status-dot" style={{ background: APP_STATUS_COLORS[app.status] }} />
            {APP_STATUS_LABELS[app.status]}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <button className="btn btn-primary btn-lg" onClick={onLaunch}>
          <Play size={18} />
          Launch Application
        </button>
        <button className="btn btn-secondary btn-lg" onClick={onOpenConfig}>
          <Settings size={18} />
          Configure
        </button>
      </div>
    </div>
  );
}

function LaunchProgressView({ app, stage }: { app: ConnectedApp; stage: LaunchStage | null }) {
  const allStages: LaunchStage[] = [
    'authorizing', 'cloning', 'verifying', 'detecting',
    'resolving_runtime', 'installing_deps', 'building',
    'starting', 'health_check', 'ready',
  ];

  const currentIndex = stage ? allStages.indexOf(stage) : -1;

  return (
    <div className="preview-loading">
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-info)', margin: '0 auto var(--space-3)' }} />
        <div style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-semibold)',
          marginBottom: 'var(--space-1)',
        }}>
          Preparing {app.repoName}
        </div>
        <div style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-tertiary)',
        }}>
          {stage ? LAUNCH_STAGE_LABELS[stage] : 'Initializing...'}
        </div>
      </div>

      <div className="progress-steps" style={{ width: '100%', maxWidth: '400px' }}>
        {allStages.map((s, i) => {
          let indicator = 'pending';
          if (i < currentIndex) indicator = 'complete';
          else if (i === currentIndex) indicator = 'active';

          return (
            <div className="progress-step" key={s}>
              <div className={`progress-step-indicator ${indicator}`}>
                {indicator === 'complete' ? (
                  <Check size={12} />
                ) : indicator === 'active' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <div className="progress-step-content">
                <div className="progress-step-title" style={{
                  color: indicator === 'pending' ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                }}>
                  {LAUNCH_STAGE_LABELS[s]}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RunningAppView({
  app,
  onOpenConfig,
}: {
  app: ConnectedApp;
  onOpenConfig: () => void;
}) {
  const { updateAppStatus } = useWorkspaceStore();
  const [iframeKey, setIframeKey] = useState(0);
  const [frameBlocked, setFrameBlocked] = useState(false);
  const previewUrl = app.previewUrl || (app.port ? `http://127.0.0.1:${app.port}` : '');

  return (
    <div className="preview-container">
      {/* Preview toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-2) var(--space-4)',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg-secondary)',
        height: '36px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span className="status-dot status-running" />
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
            {app.repoName} — Running
          </span>
          <span className="badge" style={{ background: 'var(--color-bg-tertiary)', fontSize: '10px' }}>
            {RUNTIME_LABELS[app.runtimeType]}
          </span>
          {app.port && (
            <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
              :{app.port}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <button
            className="btn btn-icon btn-ghost btn-sm"
            title="Configure application"
            onClick={onOpenConfig}
          >
            <Settings size={13} />
          </button>
          <button
            className="btn btn-icon btn-ghost btn-sm"
            title="Reload preview"
            onClick={() => {
              setFrameBlocked(false);
              setIframeKey((k) => k + 1);
            }}
          >
            <RefreshCw size={13} />
          </button>
          <button
            className="btn btn-icon btn-ghost btn-sm"
            title="Open in new window"
            onClick={() => {
              if (previewUrl && previewUrl !== 'about:blank') {
                window.open(previewUrl, '_blank');
              }
            }}
          >
            <ExternalLink size={13} />
          </button>
          <button
            className="btn btn-icon btn-ghost btn-sm"
            title="Stop application"
            onClick={async () => {
              await stopRunningApp(app.id);
              updateAppStatus(app.id, 'stopped');
            }}
          >
            <Square size={13} />
          </button>
        </div>
      </div>

      {/* Real Application Preview in Iframe */}
      <div style={{ flex: 1, position: 'relative', width: '100%', height: 'calc(100% - 36px)', display: 'flex', flexDirection: 'column' }}>
        {frameBlocked ? (
          <div className="preview-loading" style={{ flex: 1 }}>
            <AlertTriangle size={36} style={{ color: 'var(--color-warning)', marginBottom: 'var(--space-2)' }} />
            <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)' }}>
              Direct Framing Restricted
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', maxWidth: '400px', textAlign: 'center', marginBottom: 'var(--space-3)' }}>
              The application could not be rendered inside an iframe due to browser security policies.
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => window.open(previewUrl, '_blank')}
            >
              <ExternalLink size={14} />
              Open in New Window
            </button>
          </div>
        ) : (
          <iframe
            key={iframeKey}
            src={previewUrl}
            title={app.repoName}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              flex: 1,
              background: '#ffffff',
            }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            onError={() => setFrameBlocked(true)}
          />
        )}
      </div>
    </div>
  );
}

function FailedView({
  app,
  errorMessage,
  onRetry,
  onOpenConfig,
}: {
  app: ConnectedApp;
  errorMessage?: string | null;
  onRetry: () => void;
  onOpenConfig: () => void;
}) {
  return (
    <div className="preview-error">
      <AlertTriangle size={48} style={{ color: 'var(--color-error)' }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-semibold)',
          marginBottom: 'var(--space-1)',
        }}>
          Failed to launch {app.repoName}
        </div>
        <div style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-tertiary)',
          maxWidth: '440px',
        }}>
          {errorMessage || 'The application could not be started. Check port availability or configuration.'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <button className="btn btn-primary" onClick={onRetry}>
          <RefreshCw size={16} />
          Retry Launch
        </button>
        <button className="btn btn-secondary" onClick={onOpenConfig}>
          <Settings size={16} />
          Configure
        </button>
      </div>
    </div>
  );
}

function ConfigRequiredView({
  app,
  onOpenConfig,
}: {
  app: ConnectedApp;
  onOpenConfig: () => void;
}) {
  return (
    <div className="preview-loading">
      <Settings size={48} style={{ color: 'var(--color-warning)' }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-semibold)',
          marginBottom: 'var(--space-1)',
        }}>
          Configuration Required
        </div>
        <div style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-tertiary)',
          maxWidth: '440px',
        }}>
          {app.repoName} needs additional configuration before it can run.
          Please provide the required environment variables and settings.
        </div>
      </div>
      <button className="btn btn-primary" onClick={onOpenConfig}>
        <Settings size={16} />
        Open Setup Wizard
      </button>
    </div>
  );
}
