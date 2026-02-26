/**
 * Fastify Application Setup
 * 
 * Configures the Fastify server with:
 * - CORS
 * - Error handling
 * - Route registration
 * - Request logging
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { randomUUID } from 'crypto';
import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/error.middleware';
import { decisionsRoutes } from './modules/decisions/decisions.routes';
import { usersRoutes } from './modules/users/users.routes';
import { adminsRoutes } from './modules/admins/admins.routes';
import { leadsRoutes } from './modules/leads/leads.routes';

/**
 * Create and configure Fastify application instance
 *
 * @param options.pluginTimeout - Override Fastify's default 10 s plugin
 *   timeout. Pass 0 to disable (useful on Cloudflare Workers where cold-start
 *   latency is unpredictable).
 */
export async function buildApp(options?: { pluginTimeout?: number }) {
  console.log("[buildApp] creating Fastify instance");
  const app = Fastify({
    logger: false,
    pluginTimeout: options?.pluginTimeout ?? 10_000,
    requestIdLogLabel: 'requestId',
    genReqId: () => {
      return randomUUID();
    },
  });

  console.log("[buildApp] registering CORS");
  await app.register(cors, {
    origin: env.NODE_ENV === 'production' ? false : true,
    credentials: true,
  });
  console.log("[buildApp] CORS done");

  app.setErrorHandler(errorHandler);

  app.addHook('onRequest', async (request) => {
    logger.debug('Incoming request', {
      method: request.method,
      url: request.url,
      requestId: request.id,
    });
  });

  app.addHook('onResponse', async (request, reply) => {
    logger.info('Request completed', {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      requestId: request.id,
    });
  });

  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'contextgrade',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  });

  console.log("[buildApp] registering decisionsRoutes");
  await app.register(decisionsRoutes, { prefix: '/api/v1' });
  console.log("[buildApp] registering usersRoutes");
  await app.register(usersRoutes, { prefix: '/api/v1' });
  console.log("[buildApp] registering adminsRoutes");
  await app.register(adminsRoutes, { prefix: '/api/v1' });
  console.log("[buildApp] registering leadsRoutes");
  await app.register(leadsRoutes, { prefix: '/api/v1' });
  console.log("[buildApp] all routes registered");

  logger.info('Application configured', {
    environment: env.NODE_ENV,
    port: env.PORT,
  });

  return app;
}
