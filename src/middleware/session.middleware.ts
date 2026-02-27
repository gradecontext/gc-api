/**
 * Supabase Session Middleware
 *
 * Verifies Supabase JWT tokens from the Authorization header using
 * local JWKS-based verification (no secret key required).
 *
 * Supports required and optional authentication:
 * - Required (default): Returns 401 if no valid token
 * - Optional: Sets supabaseUserId to null if no token, continues
 */

import { MiddlewareHandler } from "hono";
import { verifySupabaseJwt } from "../lib/jwt";
import { logger } from "../utils/logger";

function extractBearerToken(authHeader: string | undefined): string | null {
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return null;
}

/**
 * Create a session authentication middleware for Hono.
 *
 * @param isRequired - If true (default), returns 401 when no valid session.
 *                     If false, allows unauthenticated requests through.
 */
export function sessionAuth(isRequired: boolean = true): MiddlewareHandler {
  return async (c, next) => {
    const token = extractBearerToken(c.req.header("authorization"));

    if (!token) {
      if (!isRequired) {
        c.set("supabaseUserId", null);
        c.set("supabaseUserEmail", null);
        return next();
      }
      return c.json(
        { error: "Unauthorized", message: "Bearer token is required" },
        401,
      );
    }

    try {
      const payload = await verifySupabaseJwt(token);

      if (!payload) {
        if (!isRequired) {
          c.set("supabaseUserId", null);
          c.set("supabaseUserEmail", null);
          return next();
        }
        logger.warn("Invalid Supabase session");
        return c.json(
          { error: "Unauthorized", message: "Invalid or expired session" },
          401,
        );
      }

      c.set("supabaseUserId", payload.sub);
      c.set("supabaseUserEmail", payload.email ?? null);

      logger.debug("Supabase session verified", {
        userId: payload.sub,
        email: payload.email,
      });
    } catch (err) {
      logger.error(
        "Session verification error",
        err instanceof Error ? err : new Error(String(err)),
      );

      if (!isRequired) {
        c.set("supabaseUserId", null);
        c.set("supabaseUserEmail", null);
        return next();
      }
      return c.json(
        { error: "Unauthorized", message: "Authentication failed" },
        401,
      );
    }

    return next();
  };
}
