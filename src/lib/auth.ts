/* ============================================
   Repomova Dedicated Authentication Client
   Independent client-side authentication library
   managing sessions, credentials, and user state.
   ============================================ */
import type { UserProfile } from '../types';

export type AuthUser = UserProfile;

export interface AuthSession {
  user: AuthUser;
  token: string;
}

export interface AuthResponse {
  data: {
    user: AuthUser | null;
    session: AuthSession | null;
  };
  user: AuthUser | null;
  session: AuthSession | null;
  error: Error | null;
  message?: string;
}

export type AuthChangeEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'USER_UPDATED';
export type AuthChangeCallback = (event: AuthChangeEvent, session: AuthSession | null) => void;

const TOKEN_KEY = 'repomova_auth_token';
const USER_KEY = 'repomova_auth_user';

class RepomovaAuthClient {
  private listeners: Set<AuthChangeCallback> = new Set();

  private getStoredToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  private setStoredToken(token: string | null): void {
    try {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  private getStoredUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private setStoredUser(user: AuthUser | null): void {
    try {
      if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(USER_KEY);
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  private notify(event: AuthChangeEvent, session: AuthSession | null): void {
    for (const callback of this.listeners) {
      try {
        callback(event, session);
      } catch (err) {
        console.error('[Repomova Auth] Error in auth state change listener:', err);
      }
    }
  }

  /**
   * Register a callback listener for authentication state changes.
   */
  public onAuthStateChange(callback: AuthChangeCallback): {
    data: { subscription: { unsubscribe: () => void } };
  } {
    this.listeners.add(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners.delete(callback);
          },
        },
      },
    };
  }

  /**
   * Register a new user with dedicated Repomova authentication.
   */
  public async signUp(params: {
    email: string;
    password: string;
    confirmPassword?: string;
    displayName?: string;
  }): Promise<AuthResponse> {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const error = new Error(data.error || 'Registration failed');
        return {
          data: { user: null, session: null },
          user: null,
          session: null,
          error,
        };
      }

      const session: AuthSession = {
        user: data.user,
        token: data.token,
      };

      this.setStoredToken(session.token);
      this.setStoredUser(session.user);
      this.notify('SIGNED_IN', session);

      return {
        data: { user: session.user, session },
        user: session.user,
        session,
        error: null,
        message: data.message || 'Account created successfully!',
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return {
        data: { user: null, session: null },
        user: null,
        session: null,
        error,
      };
    }
  }

  /**
   * Sign in an existing user with email and password.
   */
  public async signIn(params: {
    email: string;
    password: string;
  }): Promise<AuthResponse> {
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const error = new Error(data.error || 'Invalid credentials');
        return {
          data: { user: null, session: null },
          user: null,
          session: null,
          error,
        };
      }

      const session: AuthSession = {
        user: data.user,
        token: data.token,
      };

      this.setStoredToken(session.token);
      this.setStoredUser(session.user);
      this.notify('SIGNED_IN', session);

      return {
        data: { user: session.user, session },
        user: session.user,
        session,
        error: null,
        message: data.message || 'Signed in successfully!',
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return {
        data: { user: null, session: null },
        user: null,
        session: null,
        error,
      };
    }
  }

  /**
   * Retrieve active session, verifying the token with the server.
   */
  public async getSession(): Promise<{
    data: { session: AuthSession | null };
    session: AuthSession | null;
    error: Error | null;
  }> {
    const token = this.getStoredToken();
    if (!token) {
      return { data: { session: null }, session: null, error: null };
    }

    try {
      const res = await fetch('/api/auth/session', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        // Token expired or invalid on server
        this.setStoredToken(null);
        this.setStoredUser(null);
        return { data: { session: null }, session: null, error: null };
      }

      const data = await res.json();
      const session: AuthSession = {
        user: data.user,
        token,
      };

      this.setStoredUser(session.user);
      return { data: { session }, session, error: null };
    } catch (err: unknown) {
      // If server unreachable, check if we have cached user info
      const cachedUser = this.getStoredUser();
      if (cachedUser) {
        const fallbackSession: AuthSession = { user: cachedUser, token };
        return { data: { session: fallbackSession }, session: fallbackSession, error: null };
      }
      const error = err instanceof Error ? err : new Error(String(err));
      return { data: { session: null }, session: null, error };
    }
  }

  /**
   * Sign out the active user and invalidate server session.
   */
  public async signOut(): Promise<{ error: Error | null }> {
    const token = this.getStoredToken();
    this.setStoredToken(null);
    this.setStoredUser(null);
    this.notify('SIGNED_OUT', null);

    if (token) {
      try {
        await fetch('/api/auth/signout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // Ignore network errors on signout
      }
    }

    return { error: null };
  }

  /**
   * Update authenticated user's display name.
   */
  public async updateUser(params: { displayName?: string }): Promise<{
    data: { user: AuthUser | null };
    user: AuthUser | null;
    error: Error | null;
  }> {
    const token = this.getStoredToken();
    if (!token) {
      return {
        data: { user: null },
        user: null,
        error: new Error('Unauthorized'),
      };
    }

    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(params),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          data: { user: null },
          user: null,
          error: new Error(data.error || 'Failed to update profile'),
        };
      }

      const updatedUser: AuthUser = data.user;
      this.setStoredUser(updatedUser);
      this.notify('USER_UPDATED', { user: updatedUser, token });

      return {
        data: { user: updatedUser },
        user: updatedUser,
        error: null,
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return {
        data: { user: null },
        user: null,
        error,
      };
    }
  }
}

export const repomovaAuth = new RepomovaAuthClient();
