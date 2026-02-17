/**
 * Supabase Client
 *
 * Two clients for different use cases:
 * - supabaseAdmin: Uses service role key for server-side operations
 *   (user verification, admin tasks). Bypasses RLS.
 * - supabaseClient: Uses anon key for operations that should
 *   respect RLS policies.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

const globalForSupabase = globalThis as unknown as {
  supabaseAdmin: SupabaseClient | undefined;
  supabaseClient: SupabaseClient | undefined;
};

/**
 * Admin client — uses service role key (bypasses RLS).
 * Use for server-side user verification and admin operations.
 */
export const supabaseAdmin: SupabaseClient =
  globalForSupabase.supabaseAdmin ??
  createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

/**
 * Public client — uses anon key (respects RLS).
 * Use for operations that should go through row-level security.
 */
export const supabaseClient: SupabaseClient =
  globalForSupabase.supabaseClient ??
  createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.supabaseAdmin = supabaseAdmin;
  globalForSupabase.supabaseClient = supabaseClient;
}
