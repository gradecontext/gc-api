/**
 * API Key authentication middleware
 * Resolves client context from per-client API keys.
 *
 * Environment isolation (sandbox vs production) is handled at the
 * infrastructure level — separate DB instances and endpoints
 * (e.g. sandbox.contextgrade.com vs api.contextgrade.com).
 * The schema is identical; only DATABASE_URL differs.
 *
 * TODO: Replace with proper OAuth/JWT in production
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { prisma } from '../db/client';

export interface AuthenticatedRequest extends FastifyRequest {
  clientId?: string;
  userId?: string;
}

/**
 * Extract API key from request header or query param
 * Header: X-API-Key or Authorization: Bearer <key>
 * Query: ?apiKey=<key>
 */
function extractApiKey(request: FastifyRequest): string | null {
  // Try Authorization header
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try X-API-Key header
  const apiKeyHeader = request.headers['x-api-key'];
  if (apiKeyHeader && typeof apiKeyHeader === 'string') {
    return apiKeyHeader;
  }

  // Try query parameter (less secure, but convenient for testing)
  const queryKey = (request.query as { apiKey?: string })?.apiKey;
  if (queryKey) {
    return queryKey;
  }

  return null;
}

/**
 * Resolve API key to a client.
 * Returns the clientId if found, null otherwise.
 */
async function resolveClientApiKey(apiKey: string): Promise<string | null> {
  const client = await prisma.client.findUnique({
    where: { apiKey },
    select: { id: true },
  });

  return client?.id ?? null;
}

/**
 * API Key authentication middleware
 * Validates API key and extracts client context.
 *
 * Supports:
 * - Master API key (dev/admin — client must be in request body)
 * - Per-client API keys (resolved from clients table)
 */
export async function authenticate(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip auth if API_KEY is not configured (development mode)
  if (!env.API_KEY) {
    logger.warn('API_KEY not configured, skipping authentication');
    return;
  }

  const apiKey = extractApiKey(request);

  if (!apiKey) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'API key is required',
    });
    return;
  }

  // Check master API key first (backward compat / admin)
  if (apiKey === env.API_KEY) {
    logger.debug('Master API key authenticated', { ip: request.ip });
    // Master key: client must be provided in request body
    return;
  }

  // Resolve per-client API key
  const clientId = await resolveClientApiKey(apiKey);

  if (!clientId) {
    logger.warn('Invalid API key attempted', { ip: request.ip });
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
    return;
  }

  request.clientId = clientId;

  logger.debug('API key authenticated', {
    ip: request.ip,
    clientId,
  });
}
