/**
 * API Key authentication middleware
 * Simple key-based auth for internal services
 * TODO: Replace with proper OAuth/JWT in production
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends FastifyRequest {
  organizationId?: string;
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
 * API Key authentication middleware
 * Validates API key and extracts organization context
 * 
 * For V1, we use a simple shared API key
 * Future: Map API keys to organizations/users
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

  if (apiKey !== env.API_KEY) {
    logger.warn('Invalid API key attempted', { ip: request.ip });
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
    return;
  }

  // TODO: In future, resolve organization/user from API key
  // For now, authentication passes but organization must be provided in request body
  logger.debug('API key authenticated', { ip: request.ip });
}
