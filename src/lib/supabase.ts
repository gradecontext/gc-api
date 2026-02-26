/**
 * Supabase Client — lazy initialization
 *
 * Two clients for different use cases:
 * - supabaseAdmin: Uses secret key for elevated server-side operations
 *   (admin tasks, bypasses RLS). Optional — JWT verification is handled
 *   by local JWKS validation (see src/lib/jwt.ts), so this is only
 *   needed for admin API calls.
 * - supabaseClient: Uses publishable key for operations that
 *   should respect RLS policies.
 *
 * Both clients are created lazily (on first access) so they work
 * in Cloudflare Workers where process.env is populated after module load.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../utils/logger";

let _supabaseAdmin: SupabaseClient | null | undefined;
let _supabaseClient: SupabaseClient | undefined;

/**
 * Admin client — uses secret key (bypasses RLS).
 * Returns null if SUPABASE_SECRET_KEY is not configured.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (_supabaseAdmin === undefined) {
    const url = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (url && secretKey) {
      _supabaseAdmin = createClient(url, secretKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    } else {
      _supabaseAdmin = null;
      logger.info(
        "SUPABASE_SECRET_KEY not configured — admin client disabled. " +
          "JWT auth uses local JWKS verification (no secret key needed).",
      );
    }
  }
  return _supabaseAdmin;
}

/**
 * Public client — uses publishable key (respects RLS).
 */
export function getSupabaseClient(): SupabaseClient {
  if (!_supabaseClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY;
    if (!url || !key) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_PUBLISHABLE_DEFAULT_KEY are required",
      );
    }
    _supabaseClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _supabaseClient;
}

/**
 * Backward-compatible lazy exports.
 * Existing code that imports { supabaseAdmin, supabaseClient } keeps working.
 */
export const supabaseAdmin: SupabaseClient | null = new Proxy(
  {} as SupabaseClient,
  {
    get(_, prop) {
      const client = getSupabaseAdmin();
      if (client === null) return undefined;
      const value = (client as any)[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
  },
) as any;

export const supabaseClient: SupabaseClient = new Proxy(
  {} as SupabaseClient,
  {
    get(_, prop) {
      const client = getSupabaseClient();
      const value = (client as any)[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
  },
);
