import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://akplocloducmevybposx.supabase.co';
const SUPABASE_PUB_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_866PEmc9NqZ5YNOj2wyUCg_JE_aBCP0';

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

  const authHeader = req.headers.authorization || '';
  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  if (!token) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const newDisplayName = (body.displayName || '').trim();

    // 1. Try Supabase update
    try {
      const supaRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'apikey': SUPABASE_PUB_KEY,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: { full_name: newDisplayName },
        }),
      });

      if (supaRes.ok) {
        const supaUser = await supaRes.json();
        const safeUser = {
          id: supaUser.id,
          email: supaUser.email,
          displayName: supaUser.user_metadata?.full_name || newDisplayName,
          avatarUrl: supaUser.user_metadata?.avatar_url,
          createdAt: supaUser.created_at,
        };
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ user: safeUser }));
        return;
      }
    } catch {
      // Check local db
    }

    // 2. Fallback to local database
    const db = loadAuthDb();
    const now = new Date().toISOString();
    const session = (db.sessions || []).find((s) => s.token === token && s.expiresAt > now);

    if (!session) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Session expired or invalid. Please sign in again.' }));
      return;
    }

    const user = (db.users || []).find((u) => u.id === session.userId);
    if (!user) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'User not found' }));
      return;
    }

    if (body.displayName !== undefined) {
      user.displayName = newDisplayName || user.displayName;
      user.updatedAt = new Date().toISOString();
    }

    saveAuthDb(db);

    const safeUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ user: safeUser }));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message || 'Failed to update profile' }));
  }
}
