import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

interface StoredUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredSession {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

interface AuthDatabase {
  users: StoredUser[];
  sessions: StoredSession[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function getDbPath(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT) {
    return path.join(os.tmpdir(), 'repomova_auth_db.json');
  }
  return path.resolve(process.cwd(), '.repomova', 'auth_db.json');
}

function loadAuthDb(): AuthDatabase {
  const filePath = getDbPath();
  const fallbackPath = path.join(os.tmpdir(), 'repomova_auth_db.json');
  for (const p of [filePath, fallbackPath]) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object') {
          return {
            users: Array.isArray(parsed.users) ? parsed.users : [],
            sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
          };
        }
      }
    } catch {
      // try next
    }
  }
  return { users: [], sessions: [] };
}

function saveAuthDb(db: AuthDatabase): void {
  const filePath = getDbPath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(db, null, 2), 'utf-8');
  } catch {
    try {
      const fallbackPath = path.join(os.tmpdir(), 'repomova_auth_db.json');
      fs.writeFileSync(fallbackPath, JSON.stringify(db, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[Repomova Auth] Error saving auth db:', err);
    }
  }
}

function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

async function parseJsonBody(req: IncomingMessage & { body?: any }): Promise<any> {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  if (req.readableEnded || !req.readable) {
    return {};
  }
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf-8');
        resolve(text ? JSON.parse(text) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
    setTimeout(() => resolve({}), 2000);
  });
}

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const email = (body.email || '').trim();
    const password = body.password || '';
    const confirmPassword = body.confirmPassword;
    const rawDisplayName = (body.displayName || '').trim();

    if (!email) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Email address is required.' }));
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Please enter a valid email address.' }));
      return;
    }

    if (password.length < 6) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Password must be at least 6 characters long.' }));
      return;
    }

    if (confirmPassword !== undefined && confirmPassword !== password) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Passwords do not match. Please re-enter your password.' }));
      return;
    }

    const db = loadAuthDb();
    const normalizedEmail = email.toLowerCase();
    const existing = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (existing) {
      res.statusCode = 409;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'An account with this email address already exists. Please sign in instead.' }));
      return;
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

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

    const currentIso = new Date().toISOString();
    db.sessions = (db.sessions || []).filter((s) => s.expiresAt > currentIso);
    db.sessions.push({ token, userId, createdAt: now, expiresAt });

    saveAuthDb(db);

    res.statusCode = 201;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      user: {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.displayName,
        createdAt: newUser.createdAt,
      },
      token,
      message: 'Account created and signed in successfully!',
    }));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message || 'Registration failed' }));
  }
}
