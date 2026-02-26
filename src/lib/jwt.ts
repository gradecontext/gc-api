/**
 * Local JWT verification using Supabase's JWKS (public key) endpoint
 *
 * Instead of calling supabaseAdmin.auth.getUser() on every request (which
 * requires a secret/service_role key and adds a network round-trip), this
 * verifies tokens locally using the public keys Supabase publishes at:
 *   https://<project>.supabase.co/auth/v1/.well-known/jwks.json
 *
 * The jose library caches the JWKS keys in memory and refreshes them
 * automatically on rotation, so this approach is:
 *   - Faster (no network call per request after initial key fetch)
 *   - More reliable (no dependency on Supabase Auth server availability)
 *   - Keyless (no secret key needed for auth verification)
 *
 * Issuer / JWKS URL are resolved lazily so process.env can be
 * populated at runtime (required for Cloudflare Workers).
 *
 * @see https://supabase.com/docs/guides/auth/signing-keys
 */

import { createRemoteJWKSet, jwtVerify, JWTPayload } from "jose";
import { logger } from "../utils/logger";

export interface SupabaseJwtPayload extends JWTPayload {
  sub: string;
  email?: string;
  role?: string;
  user_metadata?: Record<string, unknown>;
}

let _issuer: string | null = null;
let _jwksUrl: URL | null = null;
let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getIssuer(): string {
  if (!_issuer) {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL is required for JWT verification");
    }
    _issuer = `${supabaseUrl}/auth/v1`;
  }
  return _issuer;
}

function getJWKS() {
  if (!_jwks) {
    if (!_jwksUrl) {
      _jwksUrl = new URL(`${getIssuer()}/.well-known/jwks.json`);
    }
    _jwks = createRemoteJWKSet(_jwksUrl);
    logger.info("JWKS key set initialized", { url: _jwksUrl.toString() });
  }
  return _jwks;
}

/**
 * Verify a Supabase JWT locally using the project's public signing keys.
 *
 * Returns the decoded payload on success, or null if verification fails.
 * The `sub` claim contains the Supabase user ID (UUID).
 */
export async function verifySupabaseJwt(
  token: string,
): Promise<SupabaseJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: getIssuer(),
    });

    if (!payload.sub) {
      logger.warn("JWT missing sub claim");
      return null;
    }

    return payload as SupabaseJwtPayload;
  } catch (err) {
    logger.debug("JWT verification failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
