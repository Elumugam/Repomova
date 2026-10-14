/* ============================================
   Dedicated Sign In Screen — Repomova
   ============================================ */
import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, Check, LogIn, ArrowLeft } from 'lucide-react';
import { useWorkspaceStore } from '../store';
import { repomovaAuth } from '../lib/auth';

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

export function SignInView() {
  const { user, isAuthenticated, setUser, setActiveView } = useWorkspaceStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // If already authenticated, display status and navigation back
  if (isAuthenticated && user) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 120px)',
        padding: 'var(--space-6)',
      }}>
        <div style={{
          maxWidth: '440px',
          width: '100%',
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          padding: 'var(--space-8)',
          textAlign: 'center',
        }}>
          <h2 style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)',
            marginBottom: 'var(--space-2)',
          }}>
            Already Signed In
          </h2>
          <p style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--space-6)',
          }}>
            You are signed in as <strong>{user.email}</strong>.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => setActiveView('apps')}
            style={{ width: '100%' }}
          >
            Go to Connected Apps
          </button>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

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

    setLoading(true);

    try {
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
        setActiveView('apps');
      }
    } catch (err: any) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 120px)',
      padding: 'var(--space-6)',
    }}>
      <div style={{
        maxWidth: '440px',
        width: '100%',
        background: 'var(--color-bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-lg)',
        padding: 'var(--space-8)',
      }}>
        {/* Navigation link back */}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setActiveView('home')}
          style={{
            marginBottom: 'var(--space-4)',
            paddingLeft: 0,
            gap: 'var(--space-1)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          <ArrowLeft size={14} />
          <span>Back to Home</span>
        </button>

        {/* Header */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h1 style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-semibold)',
            letterSpacing: 'var(--letter-spacing-tight)',
            marginBottom: 'var(--space-1)',
          }}>
            Sign In
          </h1>
          <p style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
          }}>
            Sign in to sync your connected applications and settings.
          </p>
        </div>

        {/* Error message */}
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
            marginBottom: 'var(--space-4)',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Success message */}
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
            <Check size={16} style={{ flexShrink: 0 }} />
            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form noValidate onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label className="input-label" htmlFor="signin-email">Email</label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted)',
                }}
              />
              <input
                id="signin-email"
                className="input-field"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                style={{ paddingLeft: '36px' }}
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="input-label" htmlFor="signin-password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted)',
                }}
              />
              <input
                id="signin-password"
                className="input-field"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
                style={{ paddingLeft: '36px', paddingRight: '40px' }}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="btn btn-icon btn-ghost btn-sm"
                style={{
                  position: 'absolute',
                  right: '4px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: '100%', marginTop: 'var(--space-2)' }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <LogIn size={16} />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        {/* Link to Sign Up */}
        <div style={{
          marginTop: 'var(--space-6)',
          paddingTop: 'var(--space-4)',
          borderTop: '1px solid var(--color-border)',
          textAlign: 'center',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-tertiary)',
        }}>
          Don't have an account?{' '}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{
              padding: '0 4px',
              display: 'inline',
              color: 'var(--color-accent)',
              fontWeight: 'var(--font-weight-medium)',
            }}
            onClick={() => setActiveView('signup')}
          >
            Sign up
          </button>
        </div>
      </div>
    </div>
  );
}
