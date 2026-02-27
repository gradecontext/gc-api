/**
 * API Key & Supabase authentication middleware
 *
 * Supports two authentication strategies:
 * 1. API Key — for B2B client integrations (X-API-Key header or Bearer token)
 * 2. Supabase JWT — for user-facing endpoints (Bearer token verified via Supabase)
 *
 * The middleware tries API key first, then falls back to Supabase JWT.
 */

import { Context, MiddlewareHandler } from "hono";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { prisma } from "../db/client";
import { verifySupabaseJwt } from "../lib/jwt";

function extractApiKey(c: Context): string | null {
  const apiKeyHeader = c.req.header("x-api-key");
  if (apiKeyHeader) return apiKeyHeader;

  const queryKey = c.req.query("apiKey");
  if (queryKey) return queryKey;

  return null;
}

function extractBearerToken(c: Context): string | null {
  const authHeader = c.req.header("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return null;
}

async function resolveClientApiKey(apiKey: string): Promise<number | null> {
  const client = await prisma.client.findUnique({
    where: { apiKey },
    select: { id: true },
  });
  return client?.id ?? null;
}

async function resolveSupabaseUser(
  supabaseAuthId: string,
): Promise<{ clientId: number; userId: number } | null> {
  const user = await prisma.user.findUnique({
    where: { supabaseAuthId },
    select: { id: true, clientId: true },
  });
  if (!user) return null;
  return { clientId: user.clientId, userId: user.id };
}

/**
 * Unified authentication middleware.
 *
 * Sets context variables: clientId, userId, supabaseUserId, supabaseUserEmail
 */
export const authenticate: MiddlewareHandler = async (c, next) => {
  // Strategy 1: X-API-Key header or query param
  const apiKey = extractApiKey(c);

  if (apiKey) {
    if (env.API_KEY && apiKey === env.API_KEY) {
      logger.debug("Master API key authenticated", { ip: c.req.header("cf-connecting-ip") });
      return next();
    }

    const clientId = await resolveClientApiKey(apiKey);
    if (clientId) {
      c.set("clientId", clientId);
      logger.debug("API key authenticated", { clientId });
      return next();
    }
  }

  // Strategy 2: Bearer token (master key, client key, or Supabase JWT)
  const bearerToken = extractBearerToken(c);

  if (bearerToken) {
    if (env.API_KEY && bearerToken === env.API_KEY) {
      logger.debug("Master API key (Bearer) authenticated");
      return next();
    }

    const clientId = await resolveClientApiKey(bearerToken);
    if (clientId) {
      c.set("clientId", clientId);
      logger.debug("Client API key (Bearer) authenticated", { clientId });
      return next();
    }

    try {
      const payload = await verifySupabaseJwt(bearerToken);

      if (payload) {
        c.set("supabaseUserId", payload.sub);
        c.set("supabaseUserEmail", payload.email ?? null);

        const localUser = await resolveSupabaseUser(payload.sub);
        if (localUser) {
          c.set("clientId", localUser.clientId);
          c.set("userId", localUser.userId);
        }

        logger.debug("Supabase JWT authenticated", {
          supabaseUserId: payload.sub,
          clientId: localUser?.clientId,
        });
        return next();
      }
    } catch (err) {
      logger.debug("Supabase JWT verification failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!env.API_KEY) {
    logger.warn("API_KEY not configured, skipping authentication");
    return next();
  }

  logger.warn("Authentication failed");
  return c.json(
    { error: "Unauthorized", message: "Valid API key or session token is required" },
    401,
  );
};
