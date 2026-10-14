/* ============================================
   Repomova Dedicated Authentication Service
   Server-side password hashing, session management,
   and user persistence independent of Supabase Auth.
   ============================================ */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface StoredUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredSession {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface SafeUserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface AuthDatabase {
  users: StoredUser[];
  sessions: StoredSession[];
}

export interface SignUpParams {
  email: string;
  password: string;
  confirmPassword?: string;
  displayName?: string;
}

export interface SignInParams {
  email: string;
  password: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

let inMemoryDb: AuthDatabase | null = null;
let customDbPath: string | null = null;

export function getDbPath(): string {
  if (customDbPath) return customDbPath;
  const repomovaDir = path.resolve(process.cwd(), '.repomova');
  return path.join(repomovaDir, 'auth_db.json');
}

export function setCustomDbPath(p: string | null): void {
  customDbPath = p;
  inMemoryDb = null;
}

export function loadAuthDb(): AuthDatabase {
  if (inMemoryDb) return inMemoryDb;

  const filePath = getDbPath();
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.sessions)) {
        inMemoryDb = parsed;
        return inMemoryDb as AuthDatabase;
      }
    }
  } catch (err) {
    console.warn('[Repomova Auth] Error loading auth database from disk:', err);
  }

  inMemoryDb = { users: [], sessions: [] };
  return inMemoryDb;
}

export function saveAuthDb(db: AuthDatabase): void {
  inMemoryDb = db;
  const filePath = getDbPath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Repomova Auth] Error saving auth database to disk:', err);
  }
}

export function clearAuthDb(): void {
  inMemoryDb = { users: [], sessions: [] };
  const filePath = getDbPath();
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // ignore
  }
}

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  try {
    const computed = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
    const original = Buffer.from(storedHash, 'hex');
    if (computed.length !== original.length) return false;
    return crypto.timingSafeEqual(computed, original);
  } catch {
    return false;
  }
}

export function toSafeUser(user: StoredUser): SafeUserProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

export function purgeExpiredSessions(db: AuthDatabase): void {
  const now = new Date().toISOString();
  db.sessions = db.sessions.filter((s) => s.expiresAt > now);
}

/**
 * Register a new user with email validation, password confirmation,
 * duplicate-account prevention, and secure server-side password hashing.
 */
export async function signUpUser(params: SignUpParams): Promise<{
  user: SafeUserProfile;
  token: string;
  message: string;
}> {
  const email = (params.email || '').trim();
  const password = params.password || '';
  const confirmPassword = params.confirmPassword;
  const rawDisplayName = (params.displayName || '').trim();

  if (!email) {
    const err = new Error('Email address is required.');
    (err as any).statusCode = 400;
    throw err;
  }

  if (!EMAIL_REGEX.test(email)) {
    const err = new Error('Please enter a valid email address.');
    (err as any).statusCode = 400;
    throw err;
  }

  if (password.length < 6) {
    const err = new Error('Password must be at least 6 characters long.');
    (err as any).statusCode = 400;
    throw err;
  }

  if (confirmPassword !== undefined && confirmPassword !== password) {
    const err = new Error('Passwords do not match. Please re-enter your password.');
    (err as any).statusCode = 400;
    throw err;
  }

  const db = loadAuthDb();
  const normalizedEmail = email.toLowerCase();

  const existing = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (existing) {
    const err = new Error('An account with this email address already exists. Please sign in instead.');
    (err as any).statusCode = 409;
    throw err;
  }

  const { salt, hash } = hashPassword(password);
  const now = new Date().toISOString();
  const userId = `usr_${crypto.randomUUID()}`;
  const displayName = rawDisplayName || email.split('@')[0] || 'Developer';

  const newUser: StoredUser = {
    id: userId,
    email,
    displayName,
    passwordHash: hash,
    salt,
    createdAt: now,
    updatedAt: now,
  };

  db.users.push(newUser);

  // Generate secure session token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  purgeExpiredSessions(db);
  db.sessions.push({ token, userId, createdAt: now, expiresAt });
  saveAuthDb(db);

  return {
    user: toSafeUser(newUser),
    token,
    message: 'Account created and signed in successfully!',
  };
}

/**
 * Sign in an existing user with credential verification and session generation.
 */
export async function signInUser(params: SignInParams): Promise<{
  user: SafeUserProfile;
  token: string;
  message: string;
}> {
  const email = (params.email || '').trim();
  const password = params.password || '';

  if (!email) {
    const err = new Error('Email address is required.');
    (err as any).statusCode = 400;
    throw err;
  }

  if (password.length < 6) {
    const err = new Error('Password must be at least 6 characters long.');
    (err as any).statusCode = 400;
    throw err;
  }

  const db = loadAuthDb();
  const normalizedEmail = email.toLowerCase();
  const user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
    const err = new Error('Invalid email or password. Please verify your credentials and try again.');
    (err as any).statusCode = 401;
    throw err;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  purgeExpiredSessions(db);
  db.sessions.push({ token, userId: user.id, createdAt: now, expiresAt });
  saveAuthDb(db);

  return {
    user: toSafeUser(user),
    token,
    message: 'Signed in successfully!',
  };
}

/**
 * Retrieve user profile and validate active session from a session token.
 */
export async function getSessionUser(token: string): Promise<SafeUserProfile | null> {
  if (!token) return null;

  const db = loadAuthDb();
  purgeExpiredSessions(db);

  const session = db.sessions.find((s) => s.token === token);
  if (!session) return null;

  const user = db.users.find((u) => u.id === session.userId);
  if (!user) return null;

  return toSafeUser(user);
}

/**
 * Sign out by invalidating the active session token.
 */
export async function signOutUser(token: string): Promise<{ success: boolean }> {
  if (!token) return { success: true };

  const db = loadAuthDb();
  db.sessions = db.sessions.filter((s) => s.token !== token);
  saveAuthDb(db);

  return { success: true };
}

/**
 * Update the authenticated user's profile display name.
 */
export async function updateUserProfile(
  token: string,
  updates: { displayName?: string }
): Promise<SafeUserProfile> {
  if (!token) {
    const err = new Error('Unauthorized');
    (err as any).statusCode = 401;
    throw err;
  }

  const db = loadAuthDb();
  purgeExpiredSessions(db);

  const session = db.sessions.find((s) => s.token === token);
  if (!session) {
    const err = new Error('Session expired or invalid. Please sign in again.');
    (err as any).statusCode = 401;
    throw err;
  }

  const user = db.users.find((u) => u.id === session.userId);
  if (!user) {
    const err = new Error('User not found.');
    (err as any).statusCode = 404;
    throw err;
  }

  if (updates.displayName !== undefined) {
    user.displayName = updates.displayName.trim() || user.displayName;
    user.updatedAt = new Date().toISOString();
  }

  saveAuthDb(db);
  return toSafeUser(user);
}
