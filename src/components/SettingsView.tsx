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
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('');
  const [resendSuccess, setResendSuccess] = useState('');

  // Editing profile state for signed-in users
  const [editName, setEditName] = useState(user?.displayName || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');

  // Helper to map auth error messages to user-friendly text
  function formatAuthError(err: any): string {
    if (!err) return 'An unexpected error occurred.';
    const msg = err.message || String(err);
    const code = err.code || '';

    if (code === 'invalid_credentials' || msg.toLowerCase().includes('invalid login credentials')) {
      return 'Invalid email or password. Please verify your credentials and try again.';
    }
    if (code === 'email_not_confirmed' || msg.toLowerCase().includes('email not confirmed')) {
      return 'Your email address has not been confirmed yet. Please verify your email before signing in.';
    }
    if (code === 'user_already_exists' || msg.toLowerCase().includes('already registered')) {
      return 'An account with this email address already exists. Please sign in instead.';
    }
    if (msg.toLowerCase().includes('password should be at least')) {
      return 'Password must be at least 6 characters long.';
    }
    if (msg.toLowerCase().includes('valid email')) {
      return 'Please enter a valid email address.';
    }
    if (msg.toLowerCase().includes('rate limit') || code === 'over_email_send_rate_limit') {
      return 'Too many requests. Please wait a moment before trying again.';
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
    setResendSuccess('');
    setUnconfirmedEmail('');

    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable authentication.');
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Email address is required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      if (authMode === 'signup') {
        const trimmedName = displayName.trim() || trimmedEmail.split('@')[0];
        const { data, error: authError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              displayName: trimmedName,
              full_name: trimmedName,
            },
          },
        });

        if (authError) throw authError;

        if (data.user) {
          // If Supabase returns empty identities, user already exists
          if (data.user.identities && data.user.identities.length === 0) {
            setError('An account with this email address already exists. Please sign in instead.');
            return;
          }

          if (data.session) {
            // Email auto-confirmed or confirmation disabled
            setUser({
              id: data.user.id,
              email: data.user.email || trimmedEmail,
              displayName:
                data.user.user_metadata?.displayName ||
                trimmedName,
              avatarUrl: data.user.user_metadata?.avatar_url,
              createdAt: data.user.created_at,
            });
            setSuccess('Account created and signed in successfully!');
          } else {
            // Email confirmation required
            setUnconfirmedEmail(trimmedEmail);
            setSuccess(`Registration successful! We've sent a verification email to ${trimmedEmail}. Please check your inbox and verify your email before signing in.`);
          }
        }
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (authError) {
          if (
            authError.code === 'email_not_confirmed' ||
            authError.message.toLowerCase().includes('email not confirmed')
          ) {
            setUnconfirmedEmail(trimmedEmail);
          }
          throw authError;
        }

        if (data.user && data.session) {
          setUser({
            id: data.user.id,
            email: data.user.email || trimmedEmail,
            displayName:
              data.user.user_metadata?.displayName ||
              data.user.user_metadata?.full_name ||
              data.user.email?.split('@')[0] ||
              'User',
            avatarUrl: data.user.user_metadata?.avatar_url,
            createdAt: data.user.created_at,
          });
          setSuccess('Signed in successfully!');
        }
      }
    } catch (err: any) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendConfirmation() {
    const targetEmail = unconfirmedEmail || email.trim();
    if (!targetEmail) return;

    setResending(true);
    setResendSuccess('');
    setError('');

    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
      });

      if (resendErr) throw resendErr;
      setResendSuccess(`Confirmation link sent to ${targetEmail}! Please check your inbox and spam folder.`);
    } catch (err: any) {
      setError(formatAuthError(err));
    } finally {
      setResending(false);
    }
  }

  async function handleLogout() {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('[Repomova] Sign out error:', err);
      }
    }
    setUser(null);
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim()) return;

    setSavingProfile(true);
    setProfileMessage('');

    try {
      if (isSupabaseConfigured) {
        const { data, error: updateErr } = await supabase.auth.updateUser({
          data: {
            displayName: editName.trim(),
            full_name: editName.trim(),
          },
        });
        if (updateErr) throw updateErr;

        if (user && data.user) {
          setUser({
            ...user,
            displayName: editName.trim(),
          });
        }
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
          Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable authentication.
        </div>
      )}

      {/* Unconfirmed Email Notice & Resend Option */}
      {unconfirmedEmail && (
        <div style={{
          padding: 'var(--space-4)',
          background: 'var(--color-warning-bg)',
          border: '1px solid var(--color-warning)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-4)',
          maxWidth: '380px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-warning)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-sm)' }}>
            <Mail size={16} />
            Email Verification Required
          </div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)', marginBottom: 'var(--space-3)' }}>
            Registration successful! We sent a confirmation link to <strong>{unconfirmedEmail}</strong>. Please check your inbox to activate your account.
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleResendConfirmation}
            disabled={resending}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {resending ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Resending Confirmation...
              </>
            ) : (
              'Resend Confirmation Email'
            )}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '380px' }}>
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

        {resendSuccess && (
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
            <span>{resendSuccess}</span>
          </div>
        )}

        {success && !unconfirmedEmail && (
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
            setResendSuccess('');
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
