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
  UserPlus,
} from 'lucide-react';
import { Github } from './GithubIcon';
import { useWorkspaceStore } from '../store';
import { repomovaAuth } from '../lib/auth';

type SettingsTab = 'account' | 'github' | 'appearance' | 'security';

export function SettingsView() {
  const { settingsTab, setSettingsTab } = useWorkspaceStore();

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
              className={`sidebar-item ${settingsTab === tab.id ? 'active' : ''}`}
              onClick={() => setSettingsTab(tab.id)}
              style={{ width: '100%' }}
            >
              <tab.icon size={16} className="sidebar-item-icon" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {settingsTab === 'account' && (
            <AccountSettings />
          )}
          {settingsTab === 'github' && (
            <GitHubSettings />
          )}
          {settingsTab === 'appearance' && (
            <AppearanceSettings />
          )}
          {settingsTab === 'security' && (
            <SecuritySettings />
          )}
        </div>
      </div>
    </div>
  );
}

function AccountSettings() {
  const { user, isAuthenticated, setUser, authMode, setAuthMode } = useWorkspaceStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editing profile state for signed-in users
  const [editName, setEditName] = useState(user?.displayName || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');

  // Helper to map auth error messages to user-friendly text
  function formatAuthError(err: any): string {
    if (!err) return 'An unexpected error occurred.';
    const msg = err.message || String(err);

    if (msg.toLowerCase().includes('passwords do not match')) {
      return 'Passwords do not match. Please re-enter your password.';
    }
    if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('already registered')) {
      return 'An account with this email address already exists. Please sign in instead.';
    }
    if (
      msg.toLowerCase().includes('invalid email or password') ||
      msg.toLowerCase().includes('invalid login credentials') ||
      msg.toLowerCase().includes('invalid credentials')
    ) {
      return 'Invalid email or password. Please verify your credentials and try again.';
    }
    if (msg.toLowerCase().includes('password must be at least') || msg.toLowerCase().includes('password should be at least')) {
      return 'Password must be at least 6 characters long.';
    }
    if (msg.toLowerCase().includes('valid email')) {
      return 'Please enter a valid email address.';
    }
    if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('network')) {
      return 'Network connection failure. Please check your internet connection.';
    }
    return msg;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Email address is required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (authMode === 'signup') {
      if (confirmPassword !== password) {
        setError('Passwords do not match. Please re-enter your password.');
        return;
      }
    }

    setLoading(true);

    try {
      if (authMode === 'signup') {
        const trimmedName = displayName.trim() || trimmedEmail.split('@')[0];
        const res = await repomovaAuth.signUp({
          email: trimmedEmail,
          password,
          confirmPassword,
          displayName: trimmedName,
        });

        if (res.error) {
          setError(formatAuthError(res.error));
          return;
        }

        if (res.user) {
          setUser(res.user);
          setSuccess('Account created and signed in successfully!');
        }
      } else {
        const res = await repomovaAuth.signIn({
          email: trimmedEmail,
          password,
        });

        if (res.error) {
          setError(formatAuthError(res.error));
          return;
        }

        if (res.user) {
          setUser(res.user);
          setSuccess('Signed in successfully!');
        }
      }
    } catch (err: any) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await repomovaAuth.signOut();
    } catch (err) {
      console.warn('[Repomova] Sign out error:', err);
    }
    setUser(null);
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim()) return;

    setSavingProfile(true);
    setProfileMessage('');

    try {
      const res = await repomovaAuth.updateUser({
        displayName: editName.trim(),
      });

      if (res.error) throw res.error;

      if (user && res.user) {
        setUser({
          ...user,
          displayName: res.user.displayName || editName.trim(),
        });
      } else if (user) {
        setUser({
          ...user,
          displayName: editName.trim(),
        });
      }
      setProfileMessage('Profile updated successfully!');
    } catch (err: any) {
      setProfileMessage(err.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  if (isAuthenticated && user) {
    return (
      <div>
        <h2 style={{
          fontSize: 'var(--font-size-md)',
          fontWeight: 'var(--font-weight-semibold)',
          marginBottom: 'var(--space-4)',
        }}>
          Account Profile
        </h2>

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
            marginBottom: 'var(--space-4)',
          }}>
            <Check size={14} />
            <span>{success}</span>
          </div>
        )}

        {/* User Card */}
        <div style={{
          padding: 'var(--space-5)',
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-accent)',
            color: 'var(--color-accent-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-bold)',
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-md)' }}>
              {user.displayName}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>
              {user.email}
            </div>
            {user.createdAt && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                Member since {new Date(user.createdAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        {/* Edit Display Name */}
        <form onSubmit={handleUpdateProfile} style={{ maxWidth: '400px', marginBottom: 'var(--space-6)' }}>
          <label className="input-label">Display Name</label>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
            <input
              className="input-field"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Your display name"
              maxLength={60}
            />
            <button
              type="submit"
              className="btn btn-secondary"
              disabled={savingProfile || !editName.trim() || editName.trim() === user.displayName}
            >
              {savingProfile ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
            </button>
          </div>
          {profileMessage && (
            <div style={{
              marginTop: 'var(--space-2)',
              fontSize: 'var(--font-size-xs)',
              color: profileMessage.includes('Failed') ? 'var(--color-error)' : 'var(--color-success)',
            }}>
              {profileMessage}
            </div>
          )}
        </form>

        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
          <button className="btn btn-ghost" onClick={handleLogout}>
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
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
        {authMode === 'login' ? 'Sign In' : 'Create Account'}
      </h2>
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>
        {authMode === 'login'
          ? 'Sign in to sync your connected applications and settings.'
          : 'Create a new account to get started with Repomova.'}
      </p>

      <form noValidate onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '380px' }}>
        {authMode === 'signup' && (
          <div>
            <label className="input-label">Full Name or Nickname</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                className="input-field"
                type="text"
                placeholder="Jane Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={loading}
                maxLength={60}
                style={{ paddingLeft: '36px' }}
              />
            </div>
          </div>
        )}

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
              disabled={loading}
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
              placeholder="•••••••• (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              minLength={6}
              style={{ paddingLeft: '36px', paddingRight: '40px' }}
            />
            <button
              type="button"
              className="btn btn-icon btn-ghost btn-sm"
              style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {authMode === 'signup' && (
          <div>
            <label className="input-label">Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                className="input-field"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="•••••••• (re-enter password)"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
                style={{ paddingLeft: '36px', paddingRight: '40px' }}
              />
              <button
                type="button"
                className="btn btn-icon btn-ghost btn-sm"
                style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        )}

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
            <span>{error}</span>
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
            <span>{success}</span>
          </div>
        )}

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {authMode === 'login' ? 'Signing in...' : 'Creating account...'}
            </>
          ) : (
            <>
              {authMode === 'login' ? <LogIn size={14} /> : <UserPlus size={14} />}
              {authMode === 'login' ? 'Sign In' : 'Create Account'}
            </>
          )}
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          style={{ fontSize: 'var(--font-size-sm)' }}
          onClick={() => {
            setAuthMode(authMode === 'login' ? 'signup' : 'login');
            setError('');
            setSuccess('');
            setConfirmPassword('');
          }}
        >
          {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
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
