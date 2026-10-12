/* ============================================
   App Configuration & Setup Wizard Modal
   ============================================ */
import { useState } from 'react';
import {
  X,
  Save,
  Sliders,
  Server,
  Code,
  Play,
  Eye,
  EyeOff,
  Plus,
  Trash2,
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

  // Form states
  const [runtimeType, setRuntimeType] = useState<RuntimeType>(app.runtimeType || 'static');
  const [startCommand, setStartCommand] = useState<string>(
    app.startCommand || (app.runtimeType === 'static' ? 'Built-in Static Server' : 'npm run dev')
  );
  const [buildCommand, setBuildCommand] = useState<string>(
    app.buildCommand || (app.runtimeType === 'static' ? 'None (Static files)' : '')
  );

  // Port states
  const [isPortOverride, setIsPortOverride] = useState<boolean>(false);
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

  async function handleValidateAndSave() {
    const errors: Record<string, string> = {};

    // Validate port override if enabled
    let finalPort: number | undefined = app.port;
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

    // Validate start command for non-static apps
    if (runtimeType !== 'static' && !startCommand.trim()) {
      errors.startCommand = 'Start command is required for applications to run.';
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
      startCommand: startCommand.trim() || undefined,
      buildCommand: buildCommand.trim() || undefined,
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
    }, 600);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Sliders size={20} style={{ color: 'var(--color-primary)' }} />
            <div>
              <h2 style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-semibold)',
                margin: 0,
              }}>
                Configuration Wizard — {app.repoName}
              </h2>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                {app.repoFullName} &bull; {app.defaultBranch}
              </div>
            </div>
          </div>
          <button className="btn btn-icon btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
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
          {/* Section: REQUIRED SETTINGS */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-3)',
              borderBottom: '1px solid var(--color-border-subtle)',
              paddingBottom: 'var(--space-2)',
            }}>
              <span className="badge" style={{ background: 'var(--color-primary-bg)', color: 'var(--color-primary)', fontWeight: 600 }}>
                Required Settings
              </span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                Essential for application execution
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Runtime Type */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Code size={14} />
                    Runtime Type *
                  </label>
                  {app.detectionDetails && (
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', background: 'var(--color-bg-secondary)', padding: '2px 8px', borderRadius: '4px' }}>
                      {app.detectionDetails}
                    </span>
                  )}
                </div>
                <select
                  className="input"
                  value={runtimeType}
                  onChange={(e) => setRuntimeType(e.target.value as RuntimeType)}
                >
                  {Object.entries(RUNTIME_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
                <div className="form-hint">
                  Determines how Repomova installs dependencies, runs build pipelines, and serves the application.
                </div>
              </div>

              {/* Start Command */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Play size={14} />
                    Start Command *
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                    {app.commandSources?.startCommand || (runtimeType === 'static' ? 'Auto-configured: built-in static server' : 'From package.json')}
                  </span>
                </div>
                <input
                  type="text"
                  className={`input ${inlineErrors.startCommand ? 'input-error' : ''}`}
                  value={startCommand}
                  onChange={(e) => setStartCommand(e.target.value)}
                  disabled={runtimeType === 'static'}
                />
                {inlineErrors.startCommand && (
                  <div style={{ color: 'var(--color-error)', fontSize: '12px', marginTop: '4px' }}>
                    {inlineErrors.startCommand}
                  </div>
                )}
                <div className="form-hint">
                  The command used to boot the application server so it listens for incoming requests.
                </div>
              </div>

              {/* Required Environment Variables */}
              {requiredVars.length > 0 && (
                <div>
                  <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>
                    Required Environment Variables
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {requiredVars.map((v) => (
                      <div key={v.key} style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '13px' }}>
                            {v.key} *
                          </span>
                          <span className="badge" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontSize: '10px' }}>
                            Required
                          </span>
                        </div>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={v.isSecret && !revealedSecrets[v.key] ? 'password' : 'text'}
                            className={`input ${inlineErrors[v.key] ? 'input-error' : ''}`}
                            placeholder={v.isSecret ? 'Enter secret value' : 'Enter value'}
                            value={envValues[v.key] || ''}
                            onChange={(e) => handleEnvChange(v.key, e.target.value)}
                            style={{ paddingRight: v.isSecret ? '36px' : undefined }}
                          />
                          {v.isSecret && (
                            <button
                              type="button"
                              className="btn btn-icon btn-ghost btn-sm"
                              style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }}
                              onClick={() => toggleSecretVisibility(v.key)}
                              title={revealedSecrets[v.key] ? 'Hide' : 'Reveal'}
                            >
                              {revealedSecrets[v.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          )}
                        </div>
                        {inlineErrors[v.key] && (
                          <div style={{ color: 'var(--color-error)', fontSize: '12px', marginTop: '4px' }}>
                            {inlineErrors[v.key]}
                          </div>
                        )}
                        <div className="form-hint" style={{ marginTop: '4px' }}>
                          {v.description || 'Mandatory variable extracted from repository configuration'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section: OPTIONAL SETTINGS */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-3)',
              borderBottom: '1px solid var(--color-border-subtle)',
              paddingBottom: 'var(--space-2)',
            }}>
              <span className="badge" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                Optional Settings
              </span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                Fine-tune build commands, ports, and extra variables
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Build Command */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Code size={14} />
                    Build Command
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                    {app.commandSources?.buildCommand || (runtimeType === 'static' ? 'None required' : 'From package.json')}
                  </span>
                </div>
                <input
                  type="text"
                  className="input"
                  placeholder={runtimeType === 'static' ? 'None (Static files)' : 'npm run build'}
                  value={buildCommand}
                  onChange={(e) => setBuildCommand(e.target.value)}
                  disabled={runtimeType === 'static'}
                />
                <div className="form-hint">
                  {runtimeType === 'static'
                    ? 'Plain HTML websites require no compilation step.'
                    : 'Needed because package.json has a build script, and the app cannot serve without compiled assets.'}
                </div>
              </div>

              {/* Port Allocation */}
              <div className="form-group" style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                    <Server size={14} />
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
                    {isPortOverride ? 'Revert to Auto-allocation' : 'Override Port'}
                  </button>
                </div>

                {!isPortOverride ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <input
                      type="text"
                      className="input"
                      value={app.port ? `Port ${app.port} (Assigned)` : 'Allocated dynamically at launch'}
                      readOnly
                      style={{ opacity: 0.85, cursor: 'not-allowed' }}
                    />
                    <span className="badge" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)', whiteSpace: 'nowrap' }}>
                      Conflict-Free
                    </span>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <input
                        type="number"
                        className={`input ${inlineErrors.port || portError ? 'input-error' : ''}`}
                        placeholder="e.g. 4120"
                        value={customPort}
                        onChange={(e) => {
                          setCustomPort(e.target.value);
                          setPortError(null);
                        }}
                      />
                    </div>
                    {(inlineErrors.port || portError) && (
                      <div style={{ color: 'var(--color-error)', fontSize: '12px', marginTop: '4px' }}>
                        {inlineErrors.port || portError}
                      </div>
                    )}
                  </div>
                )}
                <div className="form-hint" style={{ marginTop: '4px' }}>
                  The local TCP port on which this app listens. Allocated per app at launch to prevent port conflicts.
                </div>
              </div>

              {/* Optional Environment Variables from .env.example */}
              {optionalVars.length > 0 && (
                <div>
                  <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>
                    Optional Variables (from .env.example)
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {optionalVars.map((v) => (
                      <div key={v.key} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 36px', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {v.key}
                        </span>
                        <input
                          type={v.isSecret && !revealedSecrets[v.key] ? 'password' : 'text'}
                          className="input"
                          placeholder="Optional"
                          value={envValues[v.key] || ''}
                          onChange={(e) => handleEnvChange(v.key, e.target.value)}
                        />
                        {v.isSecret ? (
                          <button
                            type="button"
                            className="btn btn-icon btn-ghost btn-sm"
                            onClick={() => toggleSecretVisibility(v.key)}
                          >
                            {revealedSecrets[v.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        ) : <div />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Extra Environment Variables */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    Additional Environment Variables
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '11px', height: '24px' }}
                    onClick={addCustomEnvVar}
                  >
                    <Plus size={12} />
                    Add Variable
                  </button>
                </div>

                {customEnvList.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                    No additional custom variables defined.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {customEnvList.map((item, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 32px', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="input"
                          placeholder="KEY_NAME"
                          value={item.key}
                          onChange={(e) => updateCustomEnv(idx, e.target.value, item.value)}
                        />
                        <input
                          type="text"
                          className="input"
                          placeholder="Value"
                          value={item.value}
                          onChange={(e) => updateCustomEnv(idx, item.key, e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-icon btn-ghost btn-sm"
                          onClick={() => removeCustomEnv(idx)}
                        >
                          <Trash2 size={14} style={{ color: 'var(--color-error)' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ flexShrink: 0 }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleValidateAndSave} disabled={checkingPort}>
            <Save size={14} />
            {savedSuccess ? 'Saved & Resuming...' : 'Save & Resume Launch'}
          </button>
        </div>
      </div>
    </div>
  );
}
