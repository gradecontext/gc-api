/**
 * Fastify Application Setup
 *
 * Configures the Fastify server with:
 * - CORS
 * - Error handling
 * - Route registration
 * - Request logging
 */

import Fastify from "fastify";
import { randomUUID } from "crypto";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { errorHandler } from "./middleware/error.middleware";
import { decisionsRoutes } from "./modules/decisions/decisions.routes";
import { usersRoutes } from "./modules/users/users.routes";
import { adminsRoutes } from "./modules/admins/admins.routes";
import { leadsRoutes } from "./modules/leads/leads.routes";

/**
 * Create and configure Fastify application instance
 *
 * @param options.pluginTimeout - Override Fastify's default 10 s plugin
 *   timeout. Pass 0 to disable (useful on Cloudflare Workers where cold-start
 *   latency is unpredictable).
 */
export async function buildApp(options?: { pluginTimeout?: number }) {
  const app = Fastify({
    logger: false,
    pluginTimeout: options?.pluginTimeout ?? 10_000,
    requestIdLogLabel: "requestId",
    genReqId: () => {
      return randomUUID();
    },
  });
  console.log("[build] app created");

  const ALLOWED_ORIGINS = new Set([
    "https://app.contextgrade.com",
    "https://admin.contextgrade.com",
    "https://contextgrade.com",
  ]);

  app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;

    if (
      origin &&
      (env.NODE_ENV !== "production" || ALLOWED_ORIGINS.has(origin))
    ) {
      reply.header("Access-Control-Allow-Origin", origin);
      reply.header("Access-Control-Allow-Credentials", "true");
      reply.header(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD",
      );
      reply.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With",
      );
    }

    if (request.method === "OPTIONS") {
      reply.header("Access-Control-Max-Age", "86400");
      reply.status(204).send();
    }
  });
  console.log("[build] cors done");

  app.setErrorHandler(errorHandler);
  console.log("[build] errorHandler done");

  app.addHook("onRequest", async (request) => {
    logger.debug("Incoming request", {
      method: request.method,
      url: request.url,
      requestId: request.id,
    });
  });
  console.log("[build] onRequest hook done");

  app.addHook("onResponse", async (request, reply) => {
    logger.info("Request completed", {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      requestId: request.id,
    });
  });
  console.log("[build] onResponse hook done");

  app.get("/health", async () => {
    return {
      status: "ok",
      service: "contextgrade",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
    };
  });
  console.log("[build] health route done");

  await app.register(decisionsRoutes, { prefix: "/api/v1" });
  console.log("[build] decisionsRoutes done");
  await app.register(usersRoutes, { prefix: "/api/v1" });
  console.log("[build] usersRoutes done");
  await app.register(adminsRoutes, { prefix: "/api/v1" });
  console.log("[build] adminsRoutes done");
  await app.register(leadsRoutes, { prefix: "/api/v1" });
  console.log("[build] leadsRoutes done");

  logger.info("Application configured", {
    environment: env.NODE_ENV,
    port: env.PORT,
  });
  console.log("[build] application configured");

  return app;
}
