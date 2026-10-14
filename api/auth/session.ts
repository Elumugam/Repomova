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

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
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
    res.end(JSON.stringify({ error: 'Session token missing' }));
    return;
  }

  try {
    // 1. Try Supabase verification
    try {
      const supaRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          'apikey': SUPABASE_PUB_KEY,
          'Authorization': `Bearer ${token}`,
        },
      });

      if (supaRes.ok) {
        const supaUser = await supaRes.json();
        const safeUser = {
          id: supaUser.id,
          email: supaUser.email,
          displayName: supaUser.user_metadata?.full_name || supaUser.email?.split('@')[0],
          avatarUrl: supaUser.user_metadata?.avatar_url,
          createdAt: supaUser.created_at,
        };
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ user: safeUser, session: { token, user: safeUser } }));
        return;
      }
    } catch {
      // Check local db
    }

    // 2. Check local database
    const db = loadAuthDb();
    const now = new Date().toISOString();
    const session = (db.sessions || []).find((s) => s.token === token && s.expiresAt > now);

    if (!session) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Session invalid or expired' }));
      return;
    }

    const user = (db.users || []).find((u) => u.id === session.userId);
    if (!user) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'User not found' }));
      return;
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ user: safeUser, session: { token, user: safeUser } }));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message || 'Session verification failed' }));
  }
}
