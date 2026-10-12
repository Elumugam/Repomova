/* ============================================
   Supabase Client — Repomova
   ============================================ */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL) as string;
const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.SUPABASE_PUBLISHABLE_KEY
) as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Repomova] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Auth and persistence will be unavailable. See .env.example for required variables.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);
