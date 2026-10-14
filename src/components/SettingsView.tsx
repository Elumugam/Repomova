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
  Loader2,
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
  const { user, isAuthenticated, setUser, setActiveView } = useWorkspaceStore();

  // Editing profile state for signed-in users
  const [editName, setEditName] = useState(user?.displayName || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');

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
        marginBottom: 'var(--space-2)',
      }}>
        Account Profile
      </h2>
      <p style={{
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-secondary)',
        marginBottom: 'var(--space-6)',
      }}>
        You are not signed in. Sign in or create an account to sync your connected applications and settings.
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <button
          className="btn btn-primary"
          onClick={() => setActiveView('signin')}
          style={{ gap: 'var(--space-2)' }}
        >
          <LogIn size={15} />
          <span>Sign In</span>
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => setActiveView('signup')}
          style={{ gap: 'var(--space-2)' }}
        >
          <UserPlus size={15} />
          <span>Create Account</span>
        </button>
      </div>
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
