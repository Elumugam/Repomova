import { describe, it, expect } from 'vitest';
import {
  isValidSupabaseUrl,
  isValidSupabaseKey,
  isSupabaseConfigured,
  supabase,
} from '../lib/supabase';

describe('Supabase Configuration and Client', () => {
  it('validates Supabase URLs correctly', () => {
    expect(isValidSupabaseUrl('https://example.supabase.co')).toBe(true);
    expect(isValidSupabaseUrl('http://127.0.0.1:54321')).toBe(true);

    // Placeholders and empty
    expect(isValidSupabaseUrl('')).toBe(false);
    expect(isValidSupabaseUrl('https://your-project.supabase.co')).toBe(false);
    expect(isValidSupabaseUrl('https://placeholder.supabase.co')).toBe(false);
    expect(isValidSupabaseUrl('not-a-valid-url')).toBe(false);
  });

  it('validates Supabase public keys correctly', () => {
    // Valid publishable key or JWT anon key
    expect(isValidSupabaseKey('sb_publishable_866PEmc9NqZ5YNOj2wyUCg_JE_aBCP0')).toBe(true);
    expect(isValidSupabaseKey('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_jwt_token_repomova_12345')).toBe(true);

    // Placeholders and invalid
    expect(isValidSupabaseKey('')).toBe(false);
    expect(isValidSupabaseKey('your-anon-key')).toBe(false);
    expect(isValidSupabaseKey('placeholder-key')).toBe(false);
    expect(isValidSupabaseKey('too-short')).toBe(false);
  });

  it('initializes the Supabase client without throwing', () => {
    expect(supabase).toBeDefined();
    expect(supabase.auth).toBeDefined();
    expect(typeof supabase.auth.signUp).toBe('function');
    expect(typeof supabase.auth.signInWithPassword).toBe('function');
    expect(typeof supabase.auth.signOut).toBe('function');
  });

  it('reports configuration status as a boolean', () => {
    expect(typeof isSupabaseConfigured).toBe('boolean');
  });
});
