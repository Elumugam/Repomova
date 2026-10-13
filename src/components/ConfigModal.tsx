/* ============================================
   App Configuration & Setup Wizard Modal
   Minimal, Claude-inspired design system
   ============================================ */
import { useState, useId } from 'react';
import {
  X,
  Sliders,
  Server,
  Code,
  Play,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Terminal,
  FileCode,
  RotateCcw,
} from 'lucide-react';
import { useWorkspaceStore } from '../store';
import { RUNTIME_LABELS } from '../types';
import type { ConnectedApp, RuntimeType, DetectedEnvVar } from '../types';
import { checkPortAvailability } from '../lib/launchService';

interface ConfigModalProps {
  app: ConnectedApp;
  isOpen: boolean;
  onClose: () => void;
  onResumeLaunch?: () => void;
}

export function ConfigModal({ app, isOpen, onClose, onResumeLaunch }: ConfigModalProps) {
  const { updateApp } = useWorkspaceStore();
  const titleId = useId();

  // Form states
  const [runtimeType, setRuntimeType] = useState<RuntimeType>(app.runtimeType || 'static');
  const [startCommand, setStartCommand] = useState<string>(
    app.startCommand || (app.runtimeType === 'static' ? 'Built-in Static Server' : 'npm run dev')
  );
  const [buildCommand, setBuildCommand] = useState<string>(
    app.buildCommand || (app.runtimeType === 'static' ? 'None (Static files)' : '')
  );

  // Port states
  const [isPortOverride, setIsPortOverride] = useState<boolean>(!!app.port);
  const [customPort, setCustomPort] = useState<string>(app.port ? String(app.port) : '');
  const [portError, setPortError] = useState<string | null>(null);
  const [checkingPort, setCheckingPort] = useState<boolean>(false);

  // Env vars state
  const [envValues, setEnvValues] = useState<Record<string, string>>(app.envVars || {});
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [customEnvList, setCustomEnvList] = useState<Array<{ key: string; value: string }>>([]);

  // Validation & UI states
  const [inlineErrors, setInlineErrors] = useState<Record<string, string>>({});
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  // Detected environment variables from repository (.env.example)
  const detectedVars: DetectedEnvVar[] = app.detectedEnvVars || [];
  const requiredVars = detectedVars.filter((v) => v.required);
  const optionalVars = detectedVars.filter((v) => !v.required);

  const isStatic = runtimeType === 'static';
  const isCliOrLib = runtimeType === 'cli' || runtimeType === 'library';
  const isBackend = runtimeType === 'backend' || runtimeType === 'python';

  function toggleSecretVisibility(key: string) {
    setRevealedSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleEnvChange(key: string, value: string) {
    setEnvValues((prev) => ({ ...prev, [key]: value }));
    if (inlineErrors[key]) {
      setInlineErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function addCustomEnvVar() {
    setCustomEnvList((prev) => [...prev, { key: '', value: '' }]);
  }

  function updateCustomEnv(index: number, key: string, value: string) {
    setCustomEnvList((prev) => {
      const copy = [...prev];
      copy[index] = { key, value };
      return copy;
    });
  }

  function removeCustomEnv(index: number) {
    setCustomEnvList((prev) => prev.filter((_, i) => i !== index));
  }

  function handleRuntimeChange(nextType: RuntimeType) {
    setRuntimeType(nextType);
    if (nextType === 'static') {
      setStartCommand('Built-in Static Server');
      setBuildCommand('None (Static files)');
    } else if (startCommand === 'Built-in Static Server') {
      setStartCommand('npm run dev');
      setBuildCommand('');
    }
  }

  async function handleValidateAndSave() {
    const errors: Record<string, string> = {};

    // Validate port override if enabled
    let finalPort: number | undefined = isPortOverride && customPort.trim() ? parseInt(customPort.trim(), 10) : undefined;
    if (isPortOverride && customPort.trim()) {
      const portNum = parseInt(customPort.trim(), 10);
      if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
        errors.port = 'Port must be a valid number between 1024 and 65535.';
      } else {
        setCheckingPort(true);
        const portCheck = await checkPortAvailability(portNum, app.id);
        setCheckingPort(false);
        if (!portCheck.available) {
          errors.port = portCheck.reason || `Port ${portNum} is currently in use.`;
        } else {
          finalPort = portNum;
        }
      }
    }

    // Validate start command for applications that require a process
    if (!isStatic && !isCliOrLib && !startCommand.trim()) {
      errors.startCommand = 'Start command is required for application execution.';
    }

    // Validate required env vars
    for (const v of requiredVars) {
      if (!envValues[v.key]?.trim()) {
        errors[v.key] = `Required environment variable ${v.key} cannot be empty.`;
      }
    }

    if (Object.keys(errors).length > 0) {
      setInlineErrors(errors);
      return;
    }

    // Merge custom env vars into final env object
    const finalEnvs = { ...envValues };
    for (const item of customEnvList) {
      const k = item.key.trim();
      if (k) {
        finalEnvs[k] = item.value;
      }
    }

    // Update app in store
    updateApp(app.id, {
      port: finalPort,
      runtimeType,
      startCommand: isStatic ? undefined : (startCommand.trim() || undefined),
      buildCommand: isStatic ? undefined : (buildCommand.trim() || undefined),
      envVars: finalEnvs,
    });

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
      // Resume launch with updated configuration
      if (onResumeLaunch) {
        onResumeLaunch();
      }
    }, 450);
  }

  const hasErrors = Object.keys(inlineErrors).length > 0;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: '640px',
          width: '92%',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Claude minimal style */}
        <div
          className="modal-header"
          style={{
            padding: 'var(--space-4) var(--space-6)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--color-bg-primary)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-secondary)',
                flexShrink: 0,
              }}
            >
              <Sliders size={16} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <h2
                  id={titleId}
                  style={{
                    fontSize: 'var(--font-size-base)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--color-text-primary)',
                    margin: 0,
                    letterSpacing: '-0.01em',
                  }}
                >
                  Configuration Wizard — {app.repoName}
                </h2>
                <span
                  className="badge"
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-secondary)',
                    fontSize: '11px',
                    fontWeight: 500,
                    padding: '1px 8px',
                  }}
                >
                  {RUNTIME_LABELS[runtimeType] || runtimeType}
                </span>
              </div>
              <div
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                  marginTop: '1px',
                }}
              >
                {app.repoFullName} &bull; {app.defaultBranch}
              </div>
            </div>
          </div>
          <button
            className="btn btn-icon btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Close configuration wizard"
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: 'var(--space-6)',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-6)',
          }}
        >
          {/* Detected Project Overview Card */}
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-xs)' }}>
              <CheckCircle2 size={15} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
              <div>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  Detected Project Type:
                </span>{' '}
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  {app.detectionDetails || RUNTIME_LABELS[runtimeType]}
                </span>
              </div>
            </div>
            {app.entryPoint && (
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: 'var(--color-text-tertiary)',
                  backgroundColor: 'var(--color-bg-primary)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                {app.entryPoint}
              </span>
            )}
          </div>

          {/* Section: REQUIRED SETTINGS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 'var(--space-2)',
                borderBottom: '1px solid var(--color-border-subtle)',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Required Settings
                </span>
                <span
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-tertiary)',
                    marginLeft: 'var(--space-2)',
                  }}
                >
                  Essential for application execution
                </span>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--color-text-tertiary)',
                  fontWeight: 500,
                }}
              >
                * Required
              </span>
            </div>

            {/* Runtime Type Selector */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                <label
                  htmlFor="runtime-select"
                  className="input-label"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}
                >
                  <Code size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                  Runtime Type *
                </label>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  Auto-detected
                </span>
              </div>
              <select
                id="runtime-select"
                className="input-field"
                value={runtimeType}
                onChange={(e) => handleRuntimeChange(e.target.value as RuntimeType)}
                style={{ height: '38px' }}
              >
                {Object.entries(RUNTIME_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
              <div className="input-hint">
                Determines how Repomova installs dependencies, runs build pipelines, and serves the application.
              </div>
            </div>

            {/* Start Command - Project-type conditional presentation */}
            {isStatic ? (
              /* Read-only presentation for static HTML */
              <div
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Terminal size={15} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      Start Command: Built-in Static Server
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                      Serves HTML/CSS/JS assets directly. No custom start command required.
                    </div>
                  </div>
                </div>
                <span
                  className="badge"
                  style={{
                    backgroundColor: 'var(--color-success-bg)',
                    color: 'var(--color-success)',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  Auto-configured
                </span>
              </div>
            ) : isCliOrLib ? (
              /* CLI / Library: Test or execution command */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                  <label
                    htmlFor="cmd-input"
                    className="input-label"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}
                  >
                    <Terminal size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                    Execution / Test Command
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                    Optional for libraries
                  </span>
                </div>
                <input
                  id="cmd-input"
                  type="text"
                  className="input-field"
                  placeholder="e.g. npm test or python -m unittest"
                  value={startCommand === 'Built-in Static Server' ? '' : startCommand}
                  onChange={(e) => setStartCommand(e.target.value)}
                  style={{ height: '38px', fontFamily: 'monospace', fontSize: '13px' }}
                />
                <div className="input-hint">
                  Command used to run test suites or invoke CLI entry points.
                </div>
              </div>
            ) : (
              /* Frontend framework or backend service: Start command required */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                  <label
                    htmlFor="start-cmd-input"
                    className="input-label"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}
                  >
                    <Play size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                    Start Command *
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                    {app.commandSources?.startCommand || (isBackend ? 'Service boot command' : 'From package.json')}
                  </span>
                </div>
                <input
                  id="start-cmd-input"
                  type="text"
                  className={`input-field ${inlineErrors.startCommand ? 'input-error' : ''}`}
                  placeholder={isBackend ? 'e.g. uvicorn main:app --reload or npm start' : 'e.g. npm run dev'}
                  value={startCommand}
                  onChange={(e) => {
                    setStartCommand(e.target.value);
                    if (inlineErrors.startCommand) {
                      setInlineErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.startCommand;
                        return copy;
                      });
                    }
                  }}
                  style={{ height: '38px', fontFamily: 'monospace', fontSize: '13px' }}
                />
                {inlineErrors.startCommand && (
                  <div className="input-error-msg" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={12} />
                    {inlineErrors.startCommand}
                  </div>
                )}
                <div className="input-hint">
                  The command used to boot the application server so it listens for incoming requests.
                </div>
              </div>
            )}

            {/* Required Environment Variables */}
            {requiredVars.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div className="input-label" style={{ margin: 0 }}>
                  Required Environment Variables
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {requiredVars.map((v) => (
                    <div
                      key={v.key}
                      style={{
                        backgroundColor: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border)',
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 'var(--space-1)',
                        }}
                      >
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '12px' }}>
                          {v.key} *
                        </span>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: 'var(--color-warning-bg)',
                            color: 'var(--color-warning)',
                            fontSize: '10px',
                            fontWeight: 600,
                          }}
                        >
                          Required
                        </span>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={v.isSecret && !revealedSecrets[v.key] ? 'password' : 'text'}
                          className={`input-field ${inlineErrors[v.key] ? 'input-error' : ''}`}
                          placeholder={v.isSecret ? 'Enter secret value' : 'Enter value'}
                          value={envValues[v.key] || ''}
                          onChange={(e) => handleEnvChange(v.key, e.target.value)}
                          style={{
                            height: '34px',
                            fontSize: '12px',
                            paddingRight: v.isSecret ? '36px' : undefined,
                          }}
                        />
                        {v.isSecret && (
                          <button
                            type="button"
                            className="btn btn-icon btn-ghost btn-sm"
                            style={{
                              position: 'absolute',
                              right: '4px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              height: '26px',
                              width: '26px',
                            }}
                            onClick={() => toggleSecretVisibility(v.key)}
                            title={revealedSecrets[v.key] ? 'Hide' : 'Reveal'}
                          >
                            {revealedSecrets[v.key] ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        )}
                      </div>
                      {inlineErrors[v.key] && (
                        <div className="input-error-msg" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertCircle size={12} />
                          {inlineErrors[v.key]}
                        </div>
                      )}
                      <div className="input-hint" style={{ marginTop: '4px' }}>
                        {v.description || 'Mandatory variable extracted from repository configuration'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section: OPTIONAL SETTINGS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 'var(--space-2)',
                borderBottom: '1px solid var(--color-border-subtle)',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Optional Settings
                </span>
                <span
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-tertiary)',
                    marginLeft: 'var(--space-2)',
                  }}
                >
                  Fine-tune ports, build commands, and custom variables
                </span>
              </div>
            </div>

            {/* Build Command - Conditional based on runtime */}
            {isStatic ? (
              <div
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <FileCode size={15} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      Build Command: None (Static Files)
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                      Plain HTML websites require no compilation step.
                    </div>
                  </div>
                </div>
                <span
                  className="badge"
                  style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    color: 'var(--color-text-tertiary)',
                    fontSize: '11px',
                  }}
                >
                  Not needed
                </span>
              </div>
            ) : isCliOrLib ? (
              /* CLI / Library: Build or setup command */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                  <label
                    htmlFor="build-cmd-input"
                    className="input-label"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}
                  >
                    <FileCode size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                    Build / Compilation Command
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                    Optional
                  </span>
                </div>
                <input
                  id="build-cmd-input"
                  type="text"
                  className="input-field"
                  placeholder="e.g. npm run build or cargo build"
                  value={buildCommand === 'None (Static files)' ? '' : buildCommand}
                  onChange={(e) => setBuildCommand(e.target.value)}
                  style={{ height: '38px', fontFamily: 'monospace', fontSize: '13px' }}
                />
                <div className="input-hint">
                  Pre-execution build step if compilation or bundling is required.
                </div>
              </div>
            ) : (
              /* Web application: Standard Build Command */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                  <label
                    htmlFor="build-cmd-input"
                    className="input-label"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}
                  >
                    <FileCode size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                    Build Command
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                    {app.commandSources?.buildCommand || 'Optional build script'}
                  </span>
                </div>
                <input
                  id="build-cmd-input"
                  type="text"
                  className="input-field"
                  placeholder="e.g. npm run build"
                  value={buildCommand}
                  onChange={(e) => setBuildCommand(e.target.value)}
                  style={{ height: '38px', fontFamily: 'monospace', fontSize: '13px' }}
                />
                <div className="input-hint">
                  Executed before booting the server to compile assets or bundles.
                </div>
              </div>
            )}

            {/* Application Port - Project-type conditional */}
            {isCliOrLib ? (
              <div
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Server size={15} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      Network Port: Not Applicable
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                      CLI tools and libraries execute as local processes without exposing HTTP ports.
                    </div>
                  </div>
                </div>
                <span
                  className="badge"
                  style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    color: 'var(--color-text-tertiary)',
                    fontSize: '11px',
                  }}
                >
                  Console only
                </span>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label
                    htmlFor={isPortOverride ? 'port-override-input' : undefined}
                    className="input-label"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}
                  >
                    <Server size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                    Application Port
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '11px', height: '24px', padding: '0 8px' }}
                    onClick={() => {
                      setIsPortOverride(!isPortOverride);
                      setPortError(null);
                    }}
                  >
                    {isPortOverride ? (
                      <>
                        <RotateCcw size={11} />
                        Auto-allocate Port
                      </>
                    ) : (
                      'Override Port'
                    )}
                  </button>
                </div>

                {!isPortOverride ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                      {app.port ? (
                        <>
                          Assigned to TCP Port{' '}
                          <strong style={{ fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>
                            {app.port}
                          </strong>
                        </>
                      ) : (
                        'Allocated dynamically at launch'
                      )}
                    </div>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: 'var(--color-success-bg)',
                        color: 'var(--color-success)',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      Conflict-Free
                    </span>
                  </div>
                ) : (
                  <div>
                    <input
                      id="port-override-input"
                      type="number"
                      className={`input-field ${inlineErrors.port || portError ? 'input-error' : ''}`}
                      placeholder="e.g. 4120"
                      value={customPort}
                      onChange={(e) => {
                        setCustomPort(e.target.value);
                        setPortError(null);
                        if (inlineErrors.port) {
                          setInlineErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.port;
                            return copy;
                          });
                        }
                      }}
                      style={{ height: '36px', fontSize: '13px' }}
                    />
                    {(inlineErrors.port || portError) && (
                      <div className="input-error-msg" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={12} />
                        {inlineErrors.port || portError}
                      </div>
                    )}
                  </div>
                )}
                <div className="input-hint" style={{ margin: 0 }}>
                  The local TCP port on which this app listens. Allocated per app at launch to prevent port conflicts.
                </div>
              </div>
            )}

            {/* Optional Variables from .env.example */}
            {optionalVars.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label className="input-label" style={{ margin: 0 }}>
                  Optional Variables (from repository template)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {optionalVars.map((v) => (
                    <div
                      key={v.key}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '160px 1fr 34px',
                        gap: '8px',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          color: 'var(--color-text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={v.key}
                      >
                        {v.key}
                      </span>
                      <input
                        type={v.isSecret && !revealedSecrets[v.key] ? 'password' : 'text'}
                        className="input-field"
                        placeholder="Optional"
                        value={envValues[v.key] || ''}
                        onChange={(e) => handleEnvChange(v.key, e.target.value)}
                        style={{ height: '34px', fontSize: '12px' }}
                      />
                      {v.isSecret ? (
                        <button
                          type="button"
                          className="btn btn-icon btn-ghost btn-sm"
                          style={{ height: '28px', width: '28px' }}
                          onClick={() => toggleSecretVisibility(v.key)}
                        >
                          {revealedSecrets[v.key] ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      ) : (
                        <div />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Custom Environment Variables */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="input-label" style={{ margin: 0 }}>
                  Additional Environment Variables
                </label>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '11px', height: '24px', padding: '0 8px' }}
                  onClick={addCustomEnvVar}
                >
                  <Plus size={12} />
                  Add Variable
                </button>
              </div>

              {customEnvList.length === 0 ? (
                <div
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-tertiary)',
                    padding: 'var(--space-2) 0',
                  }}
                >
                  No custom environment variables configured.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {customEnvList.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '150px 1fr 30px',
                        gap: '8px',
                        alignItems: 'center',
                      }}
                    >
                      <input
                        type="text"
                        className="input-field"
                        placeholder="KEY_NAME"
                        value={item.key}
                        onChange={(e) => updateCustomEnv(idx, e.target.value, item.value)}
                        style={{ height: '34px', fontSize: '12px', fontFamily: 'monospace' }}
                      />
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Value"
                        value={item.value}
                        onChange={(e) => updateCustomEnv(idx, item.key, e.target.value)}
                        style={{ height: '34px', fontSize: '12px' }}
                      />
                      <button
                        type="button"
                        className="btn btn-icon btn-ghost btn-sm"
                        style={{ height: '28px', width: '28px' }}
                        onClick={() => removeCustomEnv(idx)}
                        title="Delete variable"
                      >
                        <Trash2 size={13} style={{ color: 'var(--color-error)' }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className="modal-footer"
          style={{
            padding: 'var(--space-3) var(--space-6)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--color-bg-primary)',
            flexShrink: 0,
          }}
        >
          {/* Status summary pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {hasErrors ? (
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--color-error)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 500,
                }}
              >
                <AlertCircle size={12} />
                Please correct configuration errors above
              </span>
            ) : (
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--color-success)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 500,
                }}
              >
                <CheckCircle2 size={12} />
                Ready to launch
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleValidateAndSave}
              disabled={checkingPort}
              style={{ minWidth: '150px' }}
            >
              {checkingPort
                ? 'Validating Port...'
                : savedSuccess
                ? 'Configuration Saved'
                : onResumeLaunch
                ? 'Save & Resume Launch'
                : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

