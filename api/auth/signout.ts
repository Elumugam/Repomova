import type { IncomingMessage, ServerResponse } from 'http';
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

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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

  try {
    if (token) {
      const db = loadAuthDb();
      db.sessions = (db.sessions || []).filter((s) => s.token !== token);
      saveAuthDb(db);
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true }));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message || 'Failed to sign out' }));
  }
}
