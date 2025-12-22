/**
 * Supabase Client Configuration
 * Shared client for frontend authentication and database operations
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

// Debug: Log if we have auth tokens in URL
if (typeof window !== 'undefined') {
  const hash = window.location.hash;
  if (hash.includes('access_token')) {
    console.log('[Supabase] OAuth tokens detected in URL hash');
  }
  const params = new URLSearchParams(window.location.search);
  if (params.has('code')) {
    console.log('[Supabase] OAuth code detected in URL query');
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  }
});

export default supabase;
