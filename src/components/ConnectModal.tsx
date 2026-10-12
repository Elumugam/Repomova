/* ============================================
   Connect Repository Modal
   ============================================ */
import { useState } from 'react';
import { X, Link2, ArrowRight, Check, Loader2, Globe } from 'lucide-react';
import { Github } from './GithubIcon';
import { useWorkspaceStore } from '../store';
import type { ConnectedApp, RuntimeType } from '../types';

import { parseGitHubUrl, guessRuntimeType } from '../lib/repoUtils';
import { detectRepositoryFramework, type DetectionResult } from '../lib/launchService';

export function ConnectModal() {
  const { connectModalOpen, setConnectModalOpen, addConnectedApp } = useWorkspaceStore();
  const [tab, setTab] = useState<'url' | 'browse'>('url');
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [parsed, setParsed] = useState<{ owner: string; name: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  if (!connectModalOpen) return null;

  function handleUrlChange(value: string) {
    setUrl(value);
    setUrlError('');
    setImportSuccess(false);
    if (value.trim()) {
      const result = parseGitHubUrl(value);
      if (result) {
        setParsed(result);
      } else {
        setParsed(null);
        if (value.length > 10) {
          setUrlError('Please enter a valid GitHub repository URL (e.g., https://github.com/owner/repo)');
        }
      }
    } else {
      setParsed(null);
    }
  }

  async function handleImport() {
    if (!parsed) return;
    setImporting(true);

    const appId = `app-${Date.now()}`;
    const trimmedUrl = url.trim();

    // Run post-clone framework detection
    let detectedRuntime: RuntimeType = guessRuntimeType(parsed.name);
    let detectionRes: DetectionResult | undefined;
    try {
      const detection = await detectRepositoryFramework(appId, trimmedUrl, parsed.name);
      detectionRes = detection;
      if (detection.runtimeType && detection.runtimeType !== 'unknown') {
        detectedRuntime = detection.runtimeType;
      }
    } catch {
      // Fallback to name heuristic
    }

    const newApp: ConnectedApp = {
      id: appId,
      userId: 'demo-user',
      repoOwner: parsed.owner,
      repoName: parsed.name,
      repoFullName: `${parsed.owner}/${parsed.name}`,
      repoUrl: trimmedUrl,
      defaultBranch: 'main',
      cloneStatus: 'cloned',
      runtimeType: detectedRuntime,
      status: 'connected',
      detectionDetails: detectionRes?.details,
      startCommand: detectionRes?.startCommand,
      buildCommand: detectionRes?.buildCommand,
      commandSources: detectionRes?.commandSources,
      detectedEnvVars: detectionRes?.detectedEnvVars,
      lastOpened: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addConnectedApp(newApp);
    setImporting(false);
    setImportSuccess(true);

    // Close after a brief delay
    setTimeout(() => {
      handleClose();
    }, 900);
  }

  function handleClose() {
    setConnectModalOpen(false);
    setUrl('');
    setUrlError('');
    setParsed(null);
    setImporting(false);
    setImportSuccess(false);
    setTab('url');
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2 style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)',
            letterSpacing: 'var(--letter-spacing-tight)',
          }}>
            Connect Repository
          </h2>
          <button className="btn btn-icon btn-ghost btn-sm" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--color-border-subtle)',
          padding: '0 var(--space-6)',
        }}>
          <button
            style={{
              padding: 'var(--space-3) var(--space-4)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              color: tab === 'url' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              borderBottom: tab === 'url' ? '2px solid var(--color-accent)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              transition: 'all var(--transition-fast)',
            }}
            onClick={() => setTab('url')}
          >
            <Link2 size={14} />
            Paste URL
          </button>
          <button
            style={{
              padding: 'var(--space-3) var(--space-4)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              color: tab === 'browse' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              borderBottom: tab === 'browse' ? '2px solid var(--color-accent)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              transition: 'all var(--transition-fast)',
            }}
            onClick={() => setTab('browse')}
          >
            <Github size={14} />
            Browse GitHub
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {tab === 'url' && (
            <div>
              <label className="input-label">GitHub Repository URL</label>
              <input
                className={`input-field ${urlError ? 'input-error' : ''}`}
                placeholder="https://github.com/owner/repository"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                autoFocus
                disabled={importing}
              />
              {urlError && <div className="input-error-msg">{urlError}</div>}
              <div className="input-hint">
                Supports public repositories. Private repos require GitHub authorization.
              </div>

              {/* Parsed preview */}
              {parsed && !importing && !importSuccess && (
                <div
                  style={{
                    marginTop: 'var(--space-4)',
                    padding: 'var(--space-4)',
                    background: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div className="app-row-icon">
                    <Globe size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-medium)',
                      color: 'var(--color-text-primary)',
                    }}>
                      {parsed.name}
                    </div>
                    <div style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-tertiary)',
                    }}>
                      {parsed.owner}/{parsed.name}
                    </div>
                  </div>
                  <Check size={16} style={{ color: 'var(--color-success)' }} />
                </div>
              )}

              {/* Import progress */}
              {importing && (
                <div
                  style={{
                    marginTop: 'var(--space-4)',
                    padding: 'var(--space-4)',
                    background: 'var(--color-info-bg)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-info)',
                  }}
                >
                  <Loader2 size={16} className="animate-spin" />
                  Connecting {parsed?.name}...
                </div>
              )}

              {/* Success */}
              {importSuccess && (
                <div
                  style={{
                    marginTop: 'var(--space-4)',
                    padding: 'var(--space-4)',
                    background: 'var(--color-success-bg)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-success)',
                  }}
                >
                  <Check size={16} />
                  Repository connected successfully!
                </div>
              )}
            </div>
          )}

          {tab === 'browse' && (
            <div className="empty-state" style={{ padding: 'var(--space-8) 0' }}>
              <Github size={40} className="empty-state-icon" />
              <div className="empty-state-title">Connect GitHub Account</div>
              <div className="empty-state-description">
                Sign in with GitHub to browse and import your repositories, including private ones.
              </div>
              <button className="btn btn-primary">
                <Github size={16} />
                Connect GitHub
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {tab === 'url' && (
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={handleClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={!parsed || importing || importSuccess}
              onClick={handleImport}
            >
              {importing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <ArrowRight size={14} />
                  Connect Repository
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
