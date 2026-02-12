/**
 * API Key authentication middleware
 * Supports production client API keys and sandbox API keys.
 * 
 * Access levels:
 * - production: Full access to live decision data (resolved from Client.apiKey)
 * - sandbox: Isolated sandbox environment (resolved from SandboxAccount.apiKey)
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
  sandboxId?: string;
  isSandbox?: boolean;
  accessLevel?: 'production' | 'sandbox';
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
 * Resolve API key to client or sandbox context.
 * 
 * Resolution order:
 * 1. Check master API key (backward compat / admin access)
 * 2. Check Client.apiKey → production access
 * 3. Check SandboxAccount.apiKey → sandbox access
 */
async function resolveApiKey(apiKey: string): Promise<{
  clientId: string;
  sandboxId?: string;
  isSandbox: boolean;
  accessLevel: 'production' | 'sandbox';
} | null> {
  // 1. Master API key (development / admin)
  if (env.API_KEY && apiKey === env.API_KEY) {
    // Master key doesn't bind to a specific client
    // Client must be provided in request body
    return null;
  }

  // 2. Try resolving as a Client production API key
  const client = await prisma.client.findUnique({
    where: { apiKey },
    select: { id: true },
  });

  if (client) {
    return {
      clientId: client.id,
      isSandbox: false,
      accessLevel: 'production',
    };
  }

  // 3. Try resolving as a Sandbox API key
  const sandbox = await prisma.sandboxAccount.findUnique({
    where: { apiKey },
    select: { id: true, clientId: true, active: true, expiresAt: true },
  });

  if (sandbox) {
    // Check sandbox is active
    if (!sandbox.active) {
      return null; // Inactive sandbox — treat as invalid key
    }

    // Check expiry
    if (sandbox.expiresAt && sandbox.expiresAt < new Date()) {
      return null; // Expired sandbox
    }

    return {
      clientId: sandbox.clientId,
      sandboxId: sandbox.id,
      isSandbox: true,
      accessLevel: 'sandbox',
    };
  }

  return null;
}

/**
 * API Key authentication middleware
 * Validates API key and extracts organization + sandbox context
 * 
 * For V1: Supports master key, per-client keys, and sandbox keys.
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

  // Check master API key first (backward compat)
  if (apiKey === env.API_KEY) {
    logger.debug('Master API key authenticated', { ip: request.ip });
    // Master key: client must be provided in request body
    return;
  }

  // Resolve client/sandbox from API key
  const resolved = await resolveApiKey(apiKey);

  if (!resolved) {
    logger.warn('Invalid API key attempted', { ip: request.ip });
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
    return;
  }

  // Set resolved context on request
  request.clientId = resolved.clientId;
  request.isSandbox = resolved.isSandbox;
  request.accessLevel = resolved.accessLevel;

  if (resolved.sandboxId) {
    request.sandboxId = resolved.sandboxId;
  }

  logger.debug('API key authenticated', {
    ip: request.ip,
    clientId: resolved.clientId,
    accessLevel: resolved.accessLevel,
    sandboxId: resolved.sandboxId || undefined,
  });
}

/**
 * Middleware to restrict access to production-only routes.
 * Use on routes that should never be called from a sandbox context.
 */
export async function requireProduction(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  if (request.isSandbox) {
    reply.code(403).send({
      error: 'Forbidden',
      message: 'This endpoint is not available in sandbox mode',
    });
  }
}

/**
 * Middleware to restrict access to sandbox-only routes.
 * Use on routes that should only be called from a sandbox context.
 */
export async function requireSandbox(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.isSandbox) {
    reply.code(403).send({
      error: 'Forbidden',
      message: 'This endpoint requires a sandbox API key',
    });
  }
}
