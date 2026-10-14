/* ============================================
   Supabase Client — Repomova
   ============================================ */
import { createClient } from '@supabase/supabase-js';

/**
 * Sanitizes an environment variable value by trimming whitespace
 * and stripping accidental surrounding single or double quotes.
 */
function sanitizeEnvValue(val: unknown): string {
  if (typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

const DEFAULT_SUPABASE_URL = 'https://akplocloducmevybposx.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_866PEmc9NqZ5YNOj2wyUCg_JE_aBCP0';

// Support both Vite client-side (import.meta.env) and Node/testing (process.env)
const rawUrl = sanitizeEnvValue(
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env && (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)) ||
  DEFAULT_SUPABASE_URL
);

// Support both standard VITE_SUPABASE_ANON_KEY and VITE_SUPABASE_PUBLISHABLE_KEY without duplicate config
const rawKey = sanitizeEnvValue(
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)) ||
  (typeof process !== 'undefined' && process.env && (process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY)) ||
  DEFAULT_SUPABASE_KEY
);

export function isValidSupabaseUrl(url: string): boolean {
  if (!url || url.includes('your-project') || url.includes('placeholder')) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidSupabaseKey(key: string): boolean {
  if (!key || key.includes('your-anon-key') || key.includes('placeholder-key')) {
    return false;
  }
  // Supabase public keys (legacy JWT anon keys or new sb_publishable_* format) are typically >= 20 chars
  return key.length >= 20;
}

export const isSupabaseConfigured = isValidSupabaseUrl(rawUrl) && isValidSupabaseKey(rawKey);

export const supabaseUrl = isSupabaseConfigured ? rawUrl : '';
export const supabaseAnonKey = isSupabaseConfigured ? rawKey : '';

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.info(
    '[Repomova] Supabase is not configured. Running in demo mode. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable cloud persistence.'
  );
}

export const supabase = createClient(
  isSupabaseConfigured ? rawUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? rawKey : 'placeholder-anon-key-repomova-demo',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);

/**
 * Persists bookmark state to Supabase connected_apps table for authenticated users.
 */
export async function syncBookmarkToSupabase(
  userId: string,
  appId: string,
  isBookmarked: boolean
): Promise<void> {
  if (!isSupabaseConfigured || !userId) return;
  try {
    const { error } = await supabase
      .from('connected_apps')
      .update({ is_starred: isBookmarked })
      .eq('id', appId)
      .eq('user_id', userId);
    if (error) {
      console.warn('[Repomova] Error syncing bookmark to Supabase:', error.message);
    }
  } catch (err) {
    console.warn('[Repomova] Exception syncing bookmark to Supabase:', err);
  }
}

/**
 * Loads bookmarked application IDs from Supabase for authenticated users.
 */
export async function loadBookmarksFromSupabase(userId: string): Promise<string[]> {
  if (!isSupabaseConfigured || !userId) return [];
  try {
    const { data, error } = await supabase
      .from('connected_apps')
      .select('id')
      .eq('user_id', userId)
      .eq('is_starred', true);
    if (error || !data) return [];
    return data.map((row: { id: string }) => row.id);
  } catch {
    return [];
  }
}
