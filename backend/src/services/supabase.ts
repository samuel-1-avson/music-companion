import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../utils/config.js';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  if (config.supabase.isConfigured) {
    try {
      // Use service role key for backend operations to bypass RLS
      const supabaseKey = config.supabase.serviceRoleKey || config.supabase.anonKey;
      
      supabaseInstance = createClient(config.supabase.url, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      });
      console.log('[Supabase] Client initialized');
    } catch (error) {
      console.error('[Supabase] Initialization error:', error);
    }
  } else {
    console.warn('[Supabase] Not configured - some features will fall back to memory/fail');
  }

  return supabaseInstance;
}

export const supabase = getSupabaseClient();
