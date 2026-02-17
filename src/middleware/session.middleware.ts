/**
 * Supabase Session Middleware
 *
 * Verifies Supabase JWT tokens from the Authorization header.
 * Used for user-facing endpoints (profile, user creation, etc.)
 *
 * Supports required and optional authentication:
 * - Required (default): Returns 401 if no valid token
 * - Optional: Sets supabaseUserId to null if no token, continues
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';

export interface SessionRequest extends FastifyRequest {
  supabaseUserId?: string | null;
  supabaseUserEmail?: string | null;
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

/**
 * Create a session authentication hook for Fastify.
 *
 * @param isRequired - If true (default), returns 401 when no valid session.
 *                     If false, allows unauthenticated requests through.
 */
export function sessionAuth(isRequired: boolean = true) {
  return async function (request: SessionRequest, reply: FastifyReply) {
    const token = extractBearerToken(request);

    if (!token) {
      if (!isRequired) {
        request.supabaseUserId = null;
        request.supabaseUserEmail = null;
        return;
      }
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Bearer token is required',
      });
      return;
    }

    try {
      const {
        data: { user },
        error,
      } = await supabaseAdmin.auth.getUser(token);

      if (error || !user) {
        if (!isRequired) {
          request.supabaseUserId = null;
          request.supabaseUserEmail = null;
          return;
        }
        logger.warn('Invalid Supabase session', {
          error: error?.message,
          ip: request.ip,
        });
        reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid or expired session',
        });
        return;
      }

      request.supabaseUserId = user.id;
      request.supabaseUserEmail = user.email ?? null;

      logger.debug('Supabase session verified', {
        userId: user.id,
        email: user.email,
        ip: request.ip,
      });
    } catch (err) {
      logger.error(
        'Session verification error',
        err instanceof Error ? err : new Error(String(err))
      );

      if (!isRequired) {
        request.supabaseUserId = null;
        request.supabaseUserEmail = null;
        return;
      }
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Authentication failed',
      });
    }
  };
}
