/**
 * API Key & Supabase authentication middleware
 *
 * Supports two authentication strategies:
 * 1. API Key — for B2B client integrations (X-API-Key header or Bearer token)
 * 2. Supabase JWT — for user-facing endpoints (Bearer token verified via Supabase)
 *
 * The middleware tries API key first, then falls back to Supabase JWT.
 *
 * Environment isolation (sandbox vs production) is handled at the
 * infrastructure level — separate DB instances and endpoints
 * (e.g. sandbox.contextgrade.com vs api.contextgrade.com).
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { prisma } from "../db/client";
import { supabaseAdmin } from "../lib/supabase";

export interface AuthenticatedRequest extends FastifyRequest {
  clientId?: number;
  userId?: number;
  supabaseUserId?: string | null;
  supabaseUserEmail?: string | null;
}

/**
 * Extract API key from X-API-Key header or query param.
 * Does NOT extract from Authorization header (reserved for Bearer tokens).
 */
function extractApiKey(request: FastifyRequest): string | null {
  const apiKeyHeader = request.headers["x-api-key"];
  if (apiKeyHeader && typeof apiKeyHeader === "string") {
    return apiKeyHeader;
  }

  const queryKey = (request.query as { apiKey?: string })?.apiKey;
  if (queryKey) {
    return queryKey;
  }

  return null;
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return null;
}

/**
 * Resolve API key to a client.
 */
async function resolveClientApiKey(apiKey: string): Promise<number | null> {
  const client = await prisma.client.findUnique({
    where: { apiKey },
    select: { id: true },
  });

  return client?.id ?? null;
}

/**
 * Resolve Supabase user to a local user + client.
 */
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
 * Authentication flow:
 * 1. Check X-API-Key header → resolve client from API key
 * 2. Check master API key (Bearer or X-API-Key)
 * 3. Check Bearer token → verify with Supabase → resolve user + client
 * 4. If nothing works → 401
 */
export async function authenticate(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  // Strategy 1: X-API-Key header or query param
  const apiKey = extractApiKey(request);

  if (apiKey) {
    // Check master API key
    if (env.API_KEY && apiKey === env.API_KEY) {
      logger.debug("Master API key authenticated", { ip: request.ip });
      return;
    }

    // Resolve per-client API key
    const clientId = await resolveClientApiKey(apiKey);
    if (clientId) {
      request.clientId = clientId;
      logger.debug("API key authenticated", { ip: request.ip, clientId });
      return;
    }
  }

  // Strategy 2: Bearer token (master key or Supabase JWT)
  const bearerToken = extractBearerToken(request);

  if (bearerToken) {
    // Check if Bearer token is the master API key
    if (env.API_KEY && bearerToken === env.API_KEY) {
      logger.debug("Master API key (Bearer) authenticated", { ip: request.ip });
      return;
    }

    // Check if Bearer token is a client API key
    const clientId = await resolveClientApiKey(bearerToken);
    if (clientId) {
      request.clientId = clientId;
      logger.debug("Client API key (Bearer) authenticated", {
        ip: request.ip,
        clientId,
      });
      return;
    }

    // Try Supabase JWT verification (requires secret key)
    if (!supabaseAdmin) {
      logger.debug("Supabase secret key not configured, skipping JWT verification");
    } else {
      try {
        const {
          data: { user },
          error,
        } = await supabaseAdmin.auth.getUser(bearerToken);

        if (!error && user) {
          request.supabaseUserId = user.id;
          request.supabaseUserEmail = user.email ?? null;

          const localUser = await resolveSupabaseUser(user.id);
          if (localUser) {
            request.clientId = localUser.clientId;
            request.userId = localUser.userId;
          }

          logger.debug("Supabase JWT authenticated", {
            ip: request.ip,
            supabaseUserId: user.id,
            clientId: localUser?.clientId,
          });
          return;
        }
      } catch (err) {
        logger.debug("Supabase JWT verification failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // Skip auth if API_KEY is not configured (development mode)
  if (!env.API_KEY) {
    logger.warn("API_KEY not configured, skipping authentication");
    return;
  }

  // No valid authentication found
  logger.warn("Authentication failed", { ip: request.ip });
  reply.code(401).send({
    error: "Unauthorized",
    message: "Valid API key or session token is required",
  });
}
