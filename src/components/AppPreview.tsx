/* ============================================
   App Preview — Embedded application view & Project Overview
   ============================================ */
import { useState, useEffect, useCallback, useRef } from 'react';
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
  Terminal,
  Package,
  Server,
  Activity,
  ChevronDown,
  ChevronUp,
  Copy,
  Info,
  Wrench,
  FileCode,
  Bookmark,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useWorkspaceStore } from '../store';
import {
  APP_STATUS_LABELS,
  APP_STATUS_COLORS,
  RUNTIME_LABELS,
  LAUNCH_STAGE_LABELS,
  isFrontendRuntime,
} from '../types';
import type { ConnectedApp, LaunchStage, AppStatus } from '../types';
import {
  launchAppWithEvents,
  stopRunningApp,
  detectRepositoryFramework,
  checkPortAvailability,
} from '../lib/launchService';
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
            hasWebInterface: res.hasWebInterface,
            projectTypeCategory: res.projectTypeCategory,
            entryPoint: res.entryPoint,
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
    // Validate missing required environment variables
    const missingRequired = (app.detectedEnvVars || []).filter(
      (v) => v.required && (!app.envVars || !app.envVars[v.key])
    );
    if (missingRequired.length > 0) {
      updateAppStatus(app.id, 'requires_configuration');
      setIsLaunching(false);
      setIsConfigOpen(true);
      return;
    }

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
      const result = await launchAppWithEvents(app, (stage) => {
        setLaunchStage(stage);
        updateAppStatus(app.id, mapStageToStatus(stage));
      });

      const nextStatus = result.hasWebInterface === false && result.runtimeType !== 'backend'
        ? 'connected'
        : 'running';

      updateApp(app.id, {
        status: nextStatus,
        port: result.port,
        previewUrl: result.previewUrl,
        runtimeType: result.runtimeType,
        hasWebInterface: result.hasWebInterface,
        projectTypeCategory: result.projectTypeCategory,
        entryPoint: result.entryPoint,
        detectionDetails: result.details || app.detectionDetails,
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

  // Determine if this project provides a graphical frontend
  const isWebProject =
    app.hasWebInterface !== false &&
    isFrontendRuntime(app.runtimeType) &&
    app.runtimeType !== 'backend' &&
    app.runtimeType !== 'cli' &&
    app.runtimeType !== 'library';

  return (
    <>
      {/* Determine view by app status and project type */}
      {app.status === 'failed' || (app.status as string) === 'error' ? (
        <ActionableFailedView
          app={app}
          errorMessage={errorMessage || app.lastError}
          onRetry={handleLaunch}
          onOpenConfig={() => setIsConfigOpen(true)}
        />
      ) : isLaunching || ['preparing', 'installing_dependencies', 'building', 'starting'].includes(app.status) ? (
        <LaunchProgressView app={app} stage={launchStage} />
      ) : app.status === 'requires_configuration' ? (
        <ConfigRequiredView app={app} onOpenConfig={() => setIsConfigOpen(true)} />
      ) : !isWebProject ? (
        /* Custom Repomova Project Overview Page for non-frontend repositories */
        <ProjectOverviewView
          app={app}
          onLaunch={handleLaunch}
          onOpenConfig={() => setIsConfigOpen(true)}
        />
      ) : app.status === 'running' && app.repoUrl ? (
        <RunningAppView app={app} onOpenConfig={() => setIsConfigOpen(true)} />
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

/* ============================================================
   Project Overview View — For non-frontend repositories
   (Backend APIs, CLI Tools, Libraries, Unconfigured projects)
   ============================================================ */
function ProjectOverviewView({
  app,
  onLaunch,
  onOpenConfig,
}: {
  app: ConnectedApp;
  onLaunch: () => void;
  onOpenConfig: () => void;
}) {
  const { updateAppStatus } = useWorkspaceStore();
  const [logsOpen, setLogsOpen] = useState(false);
  const [healthStatus, setHealthStatus] = useState<{ checked: boolean; ok?: boolean; message?: string; latency?: number } | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  const isBackend = app.runtimeType === 'backend';
  const isCli = app.runtimeType === 'cli';
  const isLibrary = app.runtimeType === 'library';

  const previewPort = app.port || 3000;
  const healthEndpointUrl = app.previewUrl || `http://127.0.0.1:${previewPort}/`;

  async function handleCheckHealth() {
    setCheckingHealth(true);
    const start = performance.now();
    try {
      const res = await fetch(healthEndpointUrl, { method: 'GET', headers: { Accept: 'application/json, text/plain, */*' } });
      const duration = Math.round(performance.now() - start);
      setHealthStatus({
        checked: true,
        ok: res.status < 400,
        message: `HTTP ${res.status} ${res.statusText || 'OK'} (${res.headers.get('content-type') || 'response'})`,
        latency: duration,
      });
    } catch (err: unknown) {
      const duration = Math.round(performance.now() - start);
      const msg = err instanceof Error ? err.message : 'Connection refused';
      setHealthStatus({
        checked: true,
        ok: false,
        message: `Health check error: ${msg}`,
        latency: duration,
      });
    } finally {
      setCheckingHealth(false);
    }
  }

  function getUnavailableExplanation(): string {
    if (isBackend) {
      return 'This repository is a backend API or service. It runs as a network service or headless process and does not provide a directly viewable browser frontend in the workspace.';
    }
    if (isCli) {
      return 'This repository is a command-line interface (CLI) tool. It is executed directly in a terminal shell environment and does not provide an HTML browser user interface.';
    }
    if (isLibrary) {
      return 'This repository is a software library or package designed to be imported as a dependency in other applications. It does not provide a standalone graphical user interface.';
    }
    return 'This project does not include a supported frontend web entry point (index.html, React, Vite, Next.js, etc.). Additional build or runtime configuration may be required.';
  }

  return (
    <div className="preview-container" style={{ background: 'var(--color-bg-primary)', overflowY: 'auto' }}>
      {/* Overview Toolbar */}
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
          <span className="status-dot" style={{ background: APP_STATUS_COLORS[app.status] }} />
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
            {app.repoName} — {APP_STATUS_LABELS[app.status]}
          </span>
          <span className="badge" style={{ background: 'var(--color-bg-tertiary)', fontSize: '10px' }}>
            {RUNTIME_LABELS[app.runtimeType]}
          </span>
          {app.port && app.status === 'running' && (
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
          {app.status === 'running' && (
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
          )}
        </div>
      </div>

      {/* Main Workspace Project Overview Content */}
      <div style={{
        padding: 'var(--space-8) var(--space-6)',
        maxWidth: '820px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
      }}>
        {/* Header Block */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-primary)',
            flexShrink: 0,
          }}>
            {isBackend ? <Server size={28} /> : isCli ? <Terminal size={28} /> : isLibrary ? <Package size={28} /> : <FileCode size={28} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <h1 style={{
                fontSize: 'var(--font-size-xl)',
                fontWeight: 'var(--font-weight-semibold)',
                margin: 0,
                color: 'var(--color-text-primary)',
              }}>
                {app.repoName}
              </h1>
              <span className="badge" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>
                {RUNTIME_LABELS[app.runtimeType]}
              </span>
              <span className="badge" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg-secondary)' }}>
                <span className="status-dot" style={{ background: APP_STATUS_COLORS[app.status] }} />
                {APP_STATUS_LABELS[app.status]}
              </span>
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>
              {app.repoFullName} &bull; {app.defaultBranch}
            </div>
          </div>
        </div>

        {/* Informational Card: Why Graphical Interface is Unavailable */}
        <div style={{
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          gap: 'var(--space-3)',
          alignItems: 'flex-start',
        }}>
          <Info size={18} style={{ color: 'var(--color-text-secondary)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
              Graphical Browser Interface Unavailable
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
              {getUnavailableExplanation()}
            </div>
          </div>
        </div>

        {/* Project Structure & Entry Points */}
        <div style={{
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4)',
          background: 'var(--color-bg-elevated)',
        }}>
          <div style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-semibold)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-text-tertiary)',
            marginBottom: 'var(--space-3)',
          }}>
            Project Structure & Configuration
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>Entry Point</div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontFamily: 'monospace', color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {app.entryPoint || (isCli ? 'bin/cli.js' : isBackend ? 'server.js' : 'index.js')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>Start Command</div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontFamily: 'monospace', color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {app.startCommand || (isBackend ? 'npm start' : 'node index.js')}
              </div>
            </div>
            {app.port ? (
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>Active Port</div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontFamily: 'monospace', color: 'var(--color-text-primary)', marginTop: '2px' }}>
                  :{app.port}
                </div>
              </div>
            ) : null}
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>Environment Variables</div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {app.detectedEnvVars && app.detectedEnvVars.length > 0 ? `${app.detectedEnvVars.length} defined` : 'None detected'}
              </div>
            </div>
          </div>
        </div>

        {/* Available Actions Block */}
        <div style={{
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4)',
          background: 'var(--color-bg-elevated)',
        }}>
          <div style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-semibold)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-text-tertiary)',
            marginBottom: 'var(--space-3)',
          }}>
            Available Actions
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {/* Backend Actions */}
            {isBackend && (
              <>
                {app.status === 'running' ? (
                  <>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleCheckHealth}
                      disabled={checkingHealth}
                    >
                      {checkingHealth ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
                      Check Health Endpoint
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={async () => {
                        await stopRunningApp(app.id);
                        updateAppStatus(app.id, 'stopped');
                      }}
                    >
                      <Square size={14} />
                      Stop Service
                    </button>
                  </>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={onLaunch}>
                    <Play size={14} />
                    Start Service
                  </button>
                )}
              </>
            )}

            <button className="btn btn-secondary btn-sm" onClick={onOpenConfig}>
              <Settings size={14} />
              Configure Project
            </button>

            <button className="btn btn-ghost btn-sm" onClick={() => setLogsOpen(!logsOpen)}>
              <FileCode size={14} />
              {logsOpen ? 'Hide Logs' : 'View Logs'}
            </button>
          </div>

          {/* Health check results panel */}
          {healthStatus && (
            <div style={{
              marginTop: 'var(--space-3)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-sm)',
              background: healthStatus.ok ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
              fontSize: 'var(--font-size-xs)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ color: healthStatus.ok ? 'var(--color-success)' : 'var(--color-error)' }}>
                {healthStatus.message}
              </span>
              {healthStatus.latency !== undefined && (
                <span style={{ color: 'var(--color-text-tertiary)', fontFamily: 'monospace' }}>
                  {healthStatus.latency}ms
                </span>
              )}
            </div>
          )}
        </div>

        {/* Runtime Diagnostics Logs Panel */}
        {logsOpen && (
          <div style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg-secondary)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: 'var(--space-2) var(--space-3)',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
            }}>
              <span>Runtime Output & System Logs</span>
              <button
                className="btn btn-ghost btn-sm"
                style={{ height: '22px', fontSize: '11px', padding: '0 6px' }}
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `[Repomova] Repository: ${app.repoFullName}\n[Repomova] Runtime: ${app.runtimeType}\n[Repomova] Status: ${app.status}\n[Repomova] Details: ${app.detectionDetails || 'None'}`
                  );
                }}
              >
                <Copy size={11} /> Copy
              </button>
            </div>
            <pre style={{
              padding: 'var(--space-3)',
              margin: 0,
              fontSize: '11px',
              fontFamily: 'monospace',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.6,
              maxHeight: '180px',
              overflowY: 'auto',
            }}>
{`[Repomova Gateway] Workspace active for: ${app.repoFullName}
[Repomova Gateway] Detected Type: ${RUNTIME_LABELS[app.runtimeType]}
[Repomova Gateway] Status: ${app.status}
${app.port ? `[Repomova Gateway] Listening Port: ${app.port}\n` : ''}${app.detectionDetails ? `[Repomova Gateway] Diagnostics: ${app.detectionDetails}\n` : ''}${isBackend ? `[Repomova Service] Backend HTTP process initialized and listening for requests.` : `[Repomova Library] Repository imported. Ready for CLI execution or downstream dependency integration.`}`}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Actionable Launch Error View
   Analyzes runtime errors and guides the user to resolve them
   ============================================================ */
interface ErrorDiagnostic {
  title: string;
  cause: string;
  explanation: string;
  missingSetting?: string;
  resolutionSteps: string[];
  quickFixField?: 'startCommand' | 'port' | 'buildCommand';
}

function analyzeLaunchError(rawError: string | null | undefined, app: ConnectedApp): ErrorDiagnostic {
  const msg = (rawError || app.detectionDetails || '').toLowerCase();

  if (msg.includes('port') || msg.includes('eaddrinuse') || msg.includes('address already in use')) {
    return {
      title: 'Port Conflict Detected',
      cause: `Port ${app.port || 'selected'} is currently unavailable or in use by another application.`,
      explanation: 'The application failed to bind its server listener because another local process is occupying this port.',
      missingSetting: `Available TCP port (conflicting port: ${app.port || 'default'})`,
      resolutionSteps: [
        'Open the Configuration Wizard or specify an alternate port below.',
        'Choose a free port between 1024 and 65535, or clear it to use dynamic conflict-free allocation.',
        'Click "Save & Retry" to launch the application.',
      ],
      quickFixField: 'port',
    };
  }

  if (msg.includes('command') || msg.includes('npm err! missing script') || msg.includes('not found') || msg.includes('spawn')) {
    return {
      title: 'Start Command Execution Failure',
      cause: `The start command "${app.startCommand || 'npm start'}" could not be found or exited with an error.`,
      explanation: 'Repomova attempted to boot the application using the configured start script, but the command failed to execute.',
      missingSetting: 'Valid runnable start command in repository package configuration',
      resolutionSteps: [
        'Check package.json or runtime entry point for the correct script name (e.g., "dev", "start", or "serve").',
        'Update the Start Command field below with the verified script.',
        'Click "Save & Retry" to relaunch.',
      ],
      quickFixField: 'startCommand',
    };
  }

  if (msg.includes('build') || msg.includes('compil') || msg.includes('syntaxerror') || msg.includes('vite build')) {
    return {
      title: 'Build Pipeline Failure',
      cause: 'The application build script exited with a non-zero exit code.',
      explanation: 'A build command is defined in package.json, but the compilation process failed before static assets could be produced.',
      missingSetting: 'Clean build script execution and compiled distribution directory',
      resolutionSteps: [
        'Review the runtime logs below to identify syntax errors, missing build arguments, or failed imports.',
        'Ensure all required build-time dependencies and environment variables are defined.',
        'Adjust the build command in Configure Project or retry after verifying the codebase.',
      ],
      quickFixField: 'buildCommand',
    };
  }

  if (msg.includes('cannot find module') || msg.includes('modulenotfounderror') || msg.includes('no module named') || msg.includes('dependencies')) {
    return {
      title: 'Missing Dependencies',
      cause: 'One or more required runtime modules or dependencies could not be resolved.',
      explanation: 'The application source code references packages that have not been installed into the local environment.',
      missingSetting: 'Complete package manifest (package-lock.json, yarn.lock, or requirements.txt)',
      resolutionSteps: [
        'Verify that all imported packages are listed in your dependencies or requirements file.',
        'Commit any updated lockfiles to your GitHub repository.',
        'Click "Retry Launch" to reinstall and prepare the workspace.',
      ],
    };
  }

  if (msg.includes('index.html') || msg.includes('entry point') || msg.includes('no web entry') || msg.includes('entry file')) {
    return {
      title: 'Frontend Entry Point Not Found',
      cause: 'An index.html file could not be found in root or common distribution folders (dist, build, public, docs).',
      explanation: 'Framework applications that generate static files at build time require an entry HTML file in their output directory.',
      missingSetting: 'Location of index.html or compiled output folder',
      resolutionSteps: [
        'If this application requires a build step to produce index.html (e.g. in dist/ or out/), specify the build command in Configure Project.',
        'If this is a backend-only service or API without a graphical interface, configure it as a backend service.',
        'Verify that the repository contains a runnable web entry point.',
      ],
    };
  }

  if (msg.includes('env') || msg.includes('environment variable') || msg.includes('missing key') || msg.includes('secret')) {
    return {
      title: 'Missing Required Environment Variables',
      cause: 'Mandatory environment variables required by the application are not configured.',
      explanation: 'The repository specifies required environment variables (e.g., in .env.example) that must be set before services can boot.',
      missingSetting: 'Values for required environment variables',
      resolutionSteps: [
        'Click "Configure Project" to open the Configuration Wizard.',
        'Enter values for all required environment variables marked with an asterisk (*).',
        'Save and resume launch.',
      ],
    };
  }

  // Fallback
  return {
    title: 'Application Launch Failed',
    cause: rawError || 'The runtime process exited or failed the health check during preparation.',
    explanation: 'Repomova could not verify that the application is running and healthy on its allocated port.',
    missingSetting: 'Valid application runtime configuration or listening server port',
    resolutionSteps: [
      'Inspect the error details and runtime logs below.',
      'Check if the application requires custom environment variables or specific start parameters.',
      'Open Configure Project to adjust runtime settings, then retry.',
    ],
  };
}

function ActionableFailedView({
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
  const { updateApp } = useWorkspaceStore();
  const diagnostic = analyzeLaunchError(errorMessage, app);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);

  // Quick fix state
  const [quickValue, setQuickValue] = useState<string>(
    diagnostic.quickFixField === 'port'
      ? (app.port ? String(app.port) : '')
      : diagnostic.quickFixField === 'startCommand'
      ? (app.startCommand || '')
      : diagnostic.quickFixField === 'buildCommand'
      ? (app.buildCommand || '')
      : ''
  );
  const [quickError, setQuickError] = useState<string | null>(null);

  async function handleSaveQuickFixAndRetry() {
    if (diagnostic.quickFixField === 'port') {
      const portNum = parseInt(quickValue.trim(), 10);
      if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
        setQuickError('Port must be a valid number between 1024 and 65535.');
        return;
      }
      const portCheck = await checkPortAvailability(portNum, app.id);
      if (!portCheck.available) {
        setQuickError(portCheck.reason || `Port ${portNum} is currently in use.`);
        return;
      }
      updateApp(app.id, { port: portNum });
    } else if (diagnostic.quickFixField === 'startCommand') {
      if (!quickValue.trim()) {
        setQuickError('Start command cannot be empty.');
        return;
      }
      updateApp(app.id, { startCommand: quickValue.trim() });
    } else if (diagnostic.quickFixField === 'buildCommand') {
      updateApp(app.id, { buildCommand: quickValue.trim() || undefined });
    }

    setQuickError(null);
    onRetry();
  }

  function handleCopyLogs() {
    const text = `Error: ${diagnostic.title}\nCause: ${diagnostic.cause}\nDetails: ${errorMessage || 'None'}`;
    navigator.clipboard?.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  }

  return (
    <div style={{
      flex: 1,
      height: '100%',
      overflowY: 'auto',
      padding: 'var(--space-8) var(--space-6)',
      background: 'var(--color-bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <div style={{ maxWidth: '640px', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {/* Error Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-error-bg)',
            color: 'var(--color-error)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <h2 style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)',
              margin: 0,
              color: 'var(--color-text-primary)',
            }}>
              {diagnostic.title}
            </h2>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
              {app.repoFullName} &bull; {RUNTIME_LABELS[app.runtimeType]}
            </div>
          </div>
        </div>

        {/* Detected Cause & Explanation */}
        <div style={{
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <span className="badge" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)', fontWeight: 600 }}>
              Detected Cause
            </span>
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
            {diagnostic.cause}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)', lineHeight: 1.5 }}>
            {diagnostic.explanation}
          </div>

          {diagnostic.missingSetting && (
            <div style={{
              marginTop: 'var(--space-3)',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg-tertiary)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
            }}>
              <Wrench size={13} style={{ flexShrink: 0, color: 'var(--color-text-tertiary)' }} />
              <span><strong>Missing / Invalid setting:</strong> {diagnostic.missingSetting}</span>
            </div>
          )}
        </div>

        {/* Step-by-Step Resolution Instructions */}
        <div style={{
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border)',
        }}>
          <div style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-semibold)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-text-tertiary)',
            marginBottom: 'var(--space-3)',
          }}>
            How to resolve this issue
          </div>
          <ol style={{
            margin: 0,
            paddingLeft: 'var(--space-4)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.6,
          }}>
            {diagnostic.resolutionSteps.map((step, idx) => (
              <li key={idx} style={{ marginBottom: 'var(--space-1)' }}>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Quick Fix Input (if applicable) */}
        {diagnostic.quickFixField && (
          <div style={{
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
          }}>
            <label className="input-label" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
              {diagnostic.quickFixField === 'port' ? 'Override Application Port' : 'Update Start Command'}
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input
                className={`input-field ${quickError ? 'input-error' : ''}`}
                style={{ flex: 1, fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}
                value={quickValue}
                onChange={(e) => {
                  setQuickValue(e.target.value);
                  setQuickError(null);
                }}
                placeholder={diagnostic.quickFixField === 'port' ? 'e.g. 4150' : 'e.g. npm run dev'}
              />
              <button className="btn btn-primary btn-sm" onClick={handleSaveQuickFixAndRetry}>
                Save & Retry
              </button>
            </div>
            {quickError && (
              <div style={{ color: 'var(--color-error)', fontSize: '11px', marginTop: '4px' }}>
                {quickError}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={onRetry}>
            <RefreshCw size={15} />
            Retry Launch
          </button>
          <button className="btn btn-secondary" onClick={onOpenConfig}>
            <Settings size={15} />
            Configure Project
          </button>
          <button
            className="btn btn-ghost"
            style={{ marginLeft: 'auto', fontSize: 'var(--font-size-xs)' }}
            onClick={() => setLogsExpanded(!logsExpanded)}
          >
            {logsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {logsExpanded ? 'Hide Logs' : 'View Logs'}
          </button>
        </div>

        {/* Collapsible Error Logs */}
        {logsExpanded && (
          <div style={{
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-secondary)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: 'var(--space-2) var(--space-3)',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
              color: 'var(--color-text-tertiary)',
            }}>
              <span>Diagnostic Logs</span>
              <button
                className="btn btn-ghost btn-sm"
                style={{ height: '22px', fontSize: '11px', padding: '0 6px' }}
                onClick={handleCopyLogs}
              >
                <Copy size={11} /> {copiedLogs ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre style={{
              margin: 0,
              padding: 'var(--space-3)',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: 'var(--color-error)',
              lineHeight: 1.5,
              maxHeight: '160px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
            }}>
              {errorMessage || 'No additional traceback available.'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Ready to Launch View
   ============================================================ */
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

/* ============================================================
   Launch Progress View
   ============================================================ */
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

/* ============================================================
   Running App View (for frontend applications in iframe)
   ============================================================ */
function RunningAppView({
  app,
  onOpenConfig,
}: {
  app: ConnectedApp;
  onOpenConfig: () => void;
}) {
  const { updateAppStatus, isBookmarked, toggleBookmark } = useWorkspaceStore();
  const [iframeKey, setIframeKey] = useState(0);
  const [frameBlocked, setFrameBlocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewUrl = app.previewUrl || (app.port ? `http://127.0.0.1:${app.port}` : '');
  const bookmarked = isBookmarked(app.id);
  const appDisplayName = app.displayName || app.repoName;

  const handleEnterFullscreen = useCallback(async () => {
    setIsFullscreen(true);
    try {
      if (containerRef.current && typeof containerRef.current.requestFullscreen === 'function') {
        if (!document.fullscreenElement) {
          await containerRef.current.requestFullscreen().catch(() => {});
        }
      }
    } catch {
      // Graceful fallback to Repomova workspace CSS full-screen
    }
  }, []);

  const handleExitFullscreen = useCallback(async () => {
    setIsFullscreen(false);
    try {
      if (typeof document.exitFullscreen === 'function' && document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }
    } catch {
      // Ignore exit fullscreen error
    }
  }, []);

  // Listen to Topbar / external reload and full-screen events targeted at this application
  useEffect(() => {
    const handleReload = (e: Event) => {
      const customEvent = e as CustomEvent<{ appId?: string }>;
      if (!customEvent.detail || !customEvent.detail.appId || customEvent.detail.appId === app.id) {
        setFrameBlocked(false);
        setIframeKey((k) => k + 1);
      }
    };
    const handleFullscreenTrigger = (e: Event) => {
      const customEvent = e as CustomEvent<{ appId?: string }>;
      if (!customEvent.detail || !customEvent.detail.appId || customEvent.detail.appId === app.id) {
        handleEnterFullscreen();
      }
    };
    window.addEventListener('repomova-reload-preview', handleReload);
    window.addEventListener('repomova-enter-fullscreen', handleFullscreenTrigger);
    return () => {
      window.removeEventListener('repomova-reload-preview', handleReload);
      window.removeEventListener('repomova-enter-fullscreen', handleFullscreenTrigger);
    };
  }, [app.id, handleEnterFullscreen]);

  // Handle Escape key and browser fullscreenchange events
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleExitFullscreen();
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isFullscreen, handleExitFullscreen]);

  return (
    <div
      ref={containerRef}
      className={`preview-container ${isFullscreen ? 'preview-fullscreen' : ''}`}
      data-testid="running-app-view"
    >
      {/* Floating Exit Button in Fullscreen Mode */}
      {isFullscreen && (
        <button
          className="btn btn-secondary btn-sm preview-exit-fullscreen-btn"
          onClick={handleExitFullscreen}
          title="Exit full-screen workspace view (Esc)"
          aria-label="Exit full screen"
          style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            zIndex: 10000,
            boxShadow: 'var(--shadow-lg)',
            background: 'var(--color-bg-elevated)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--color-border-strong)',
            color: 'var(--color-text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            cursor: 'pointer',
          }}
        >
          <Minimize2 size={14} />
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)' }}>
            Exit Full Screen (Esc)
          </span>
        </button>
      )}

      {/* Preview toolbar (hidden in full-screen workspace mode) */}
      {!isFullscreen && (
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
              {appDisplayName} — Running
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
              title={bookmarked ? `Unbookmark ${appDisplayName}` : `Bookmark ${appDisplayName}`}
              aria-label={bookmarked ? `Unbookmark ${appDisplayName}` : `Bookmark ${appDisplayName}`}
              onClick={() => toggleBookmark(app.id)}
            >
              <Bookmark
                size={13}
                fill={bookmarked ? 'currentColor' : 'none'}
                style={{ color: bookmarked ? 'var(--color-warning)' : undefined }}
              />
            </button>
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
              title="Enter full-screen workspace view"
              aria-label="Enter full-screen workspace view"
              onClick={handleEnterFullscreen}
            >
              <Maximize2 size={13} />
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
      )}

      {/* Real Application Preview in Iframe */}
      <div style={{
        flex: 1,
        position: 'relative',
        width: '100%',
        height: isFullscreen ? '100%' : 'calc(100% - 36px)',
        display: 'flex',
        flexDirection: 'column',
      }}>
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
            title={appDisplayName}
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

/* ============================================================
   Config Required View
   ============================================================ */
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
