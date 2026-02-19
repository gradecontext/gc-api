/**
 * Supabase Client
 *
 * Two clients for different use cases:
 * - supabaseAdmin: Uses secret key for server-side operations
 *   (user verification, admin tasks). Bypasses RLS.
 *   Only available when SUPABASE_SECRET_KEY is configured.
 * - supabaseClient: Uses publishable key for operations that
 *   should respect RLS policies.
 *
 * Key format (new Supabase convention):
 *   Publishable key (sb_publishable_...) — safe to expose client-side
 *   Secret key (sb_secret_...)           — backend only, elevated privileges
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env";

const globalForSupabase = globalThis as unknown as {
  supabaseAdmin: SupabaseClient | undefined;
  supabaseClient: SupabaseClient | undefined;
};

/**
 * Admin client — uses secret key (bypasses RLS).
 * Use for server-side user verification and admin operations.
 * Will be null if SUPABASE_SECRET_KEY is not configured.
 */
export const supabaseAdmin: SupabaseClient | null =
  globalForSupabase.supabaseAdmin ??
  (env.SUPABASE_SECRET_KEY
    ? createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null);

/**
 * Public client — uses publishable key (respects RLS).
 * Use for operations that should go through row-level security.
 */
export const supabaseClient: SupabaseClient =
  globalForSupabase.supabaseClient ??
  createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_DEFAULT_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

if (process.env.NODE_ENV !== "production") {
  if (supabaseAdmin) globalForSupabase.supabaseAdmin = supabaseAdmin;
  globalForSupabase.supabaseClient = supabaseClient;
}
