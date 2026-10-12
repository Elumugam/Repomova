/* ============================================
   Settings View
   ============================================ */
import React, { useState } from 'react';
import {
  User,
  Palette,
  Shield,
  LogOut,
  LogIn,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Github } from './GithubIcon';
import { useWorkspaceStore } from '../store';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

type SettingsTab = 'account' | 'github' | 'appearance' | 'security';

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');

  const tabs: { id: SettingsTab; label: string; icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }> }[] = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'github', label: 'GitHub', icon: Github },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 'var(--content-max-width)', margin: '0 auto', width: '100%' }}>
      <h1 style={{
        fontSize: 'var(--font-size-xl)',
        fontWeight: 'var(--font-weight-semibold)',
        letterSpacing: 'var(--letter-spacing-tight)',
        marginBottom: 'var(--space-6)',
      }}>
        Settings
      </h1>

      <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
        {/* Tab nav */}
        <div style={{ width: '200px', flexShrink: 0 }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`sidebar-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ width: '100%' }}
            >
              <tab.icon size={16} className="sidebar-item-icon" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {activeTab === 'account' && (
            <AccountSettings />
          )}
          {activeTab === 'github' && (
            <GitHubSettings />
          )}
          {activeTab === 'appearance' && (
            <AppearanceSettings />
          )}
          {activeTab === 'security' && (
            <SecuritySettings />
          )}
        </div>
      </div>
    </div>
  );
}

function AccountSettings() {
  const { user, isAuthenticated, setUser } = useWorkspaceStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!isSupabaseConfigured) {
      // Demo mode — create a local user
      setTimeout(() => {
        setUser({
          id: 'demo-' + Date.now(),
          email: email,
          displayName: email.split('@')[0],
          createdAt: new Date().toISOString(),
        });
        setSuccess(mode === 'login' ? 'Signed in (demo mode)' : 'Account created (demo mode)');
        setLoading(false);
      }, 800);
      return;
    }

    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) throw authError;
        if (data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email || email,
            displayName: data.user.email?.split('@')[0] || '',
            createdAt: data.user.created_at,
          });
          setSuccess('Account created! Check your email for verification.');
        }
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        if (data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email || email,
            displayName: data.user.email?.split('@')[0] || '',
            createdAt: data.user.created_at,
          });
          setSuccess('Signed in successfully!');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
  }

  if (isAuthenticated && user) {
    return (
      <div>
        <h2 style={{
          fontSize: 'var(--font-size-md)',
          fontWeight: 'var(--font-weight-semibold)',
          marginBottom: 'var(--space-4)',
        }}>
          Account
        </h2>
        <div style={{
          padding: 'var(--space-4)',
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-4)',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-accent)',
            color: 'var(--color-accent-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)',
          }}>
            {user.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 'var(--font-weight-medium)' }}>{user.displayName}</div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>{user.email}</div>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={handleLogout}>
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{
        fontSize: 'var(--font-size-md)',
        fontWeight: 'var(--font-weight-semibold)',
        marginBottom: 'var(--space-1)',
      }}>
        {mode === 'login' ? 'Sign In' : 'Create Account'}
      </h2>
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>
        {mode === 'login'
          ? 'Sign in to save your connected applications.'
          : 'Create a new account to get started.'}
      </p>

      {!isSupabaseConfigured && (
        <div style={{
          padding: 'var(--space-3)',
          background: 'var(--color-warning-bg)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-warning)',
          marginBottom: 'var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          <AlertCircle size={14} />
          Supabase not configured. Running in demo mode.
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '360px' }}>
        <div>
          <label className="input-label">Email</label>
          <div style={{ position: 'relative' }}>
            <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              className="input-field"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ paddingLeft: '36px' }}
            />
          </div>
        </div>

        <div>
          <label className="input-label">Password</label>
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              className="input-field"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{ paddingLeft: '36px', paddingRight: '40px' }}
            />
            <button
              type="button"
              className="btn btn-icon btn-ghost btn-sm"
              style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            padding: 'var(--space-3)',
            background: 'var(--color-error-bg)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-error)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}>
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {success && (
          <div style={{
            padding: 'var(--space-3)',
            background: 'var(--color-success-bg)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-success)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}>
            <Check size={14} />
            {success}
          </div>
        )}

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {mode === 'login' ? 'Signing in...' : 'Creating account...'}
            </>
          ) : (
            <>
              <LogIn size={14} />
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </>
          )}
        </button>

        {!isSupabaseConfigured && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setUser({
                id: 'demo-developer',
                email: 'developer@repomova.local',
                displayName: 'Demo Developer',
                createdAt: new Date().toISOString(),
              });
            }}
          >
            Instant Demo Sign In
          </button>
        )}

        <button
          type="button"
          className="btn btn-ghost"
          style={{ fontSize: 'var(--font-size-sm)' }}
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError('');
            setSuccess('');
          }}
        >
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}

function GitHubSettings() {
  return (
    <div>
      <h2 style={{
        fontSize: 'var(--font-size-md)',
        fontWeight: 'var(--font-weight-semibold)',
        marginBottom: 'var(--space-1)',
      }}>
        GitHub Integration
      </h2>
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>
        Connect your GitHub account to browse and import private repositories.
      </p>
      <div style={{
        padding: 'var(--space-6)',
        background: 'var(--color-bg-secondary)',
        borderRadius: 'var(--radius-md)',
        textAlign: 'center',
      }}>
        <Github size={32} style={{ color: 'var(--color-text-muted)', margin: '0 auto var(--space-3)' }} />
        <div style={{ fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>
          GitHub not connected
        </div>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>
          You can still import public repositories via URL.
        </div>
        <button className="btn btn-primary">
          <Github size={16} />
          Connect GitHub Account
        </button>
      </div>
    </div>
  );
}

function AppearanceSettings() {
  const { theme, setTheme } = useWorkspaceStore();

  return (
    <div>
      <h2 style={{
        fontSize: 'var(--font-size-md)',
        fontWeight: 'var(--font-weight-semibold)',
        marginBottom: 'var(--space-4)',
      }}>
        Appearance
      </h2>

      <div>
        <label className="input-label">Theme</label>
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
          {(['light', 'dark'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              style={{
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${theme === t ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: t === 'light' ? '#ffffff' : '#0a0a0a',
                cursor: 'pointer',
                width: '120px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--space-2)',
                transition: 'border-color var(--transition-fast)',
              }}
            >
              <div style={{
                width: '100%',
                height: '60px',
                borderRadius: 'var(--radius-sm)',
                background: t === 'light' ? '#f8f9fa' : '#161616',
                border: `1px solid ${t === 'light' ? '#e9ecef' : '#222222'}`,
              }} />
              <span style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-medium)',
                color: t === 'light' ? '#0a0a0a' : '#f1f3f5',
                textTransform: 'capitalize',
              }}>
                {t}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SecuritySettings() {
  return (
    <div>
      <h2 style={{
        fontSize: 'var(--font-size-md)',
        fontWeight: 'var(--font-weight-semibold)',
        marginBottom: 'var(--space-1)',
      }}>
        Security
      </h2>
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>
        Manage application security and session settings.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{
          padding: 'var(--space-4)',
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-md)',
        }}>
          <div style={{ fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>
            Runtime Isolation
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>
            Each imported repository runs in an isolated container environment.
            No repository has access to your local filesystem or other projects.
          </div>
        </div>
        <div style={{
          padding: 'var(--space-4)',
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-md)',
        }}>
          <div style={{ fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>
            Secret Management
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>
            Secrets and API keys are encrypted at rest and never exposed in client code.
            They are only injected into the authorized runtime environment.
          </div>
        </div>
      </div>
    </div>
  );
}
