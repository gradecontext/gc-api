/**
 * Hono Application Setup
 *
 * Configures the Hono app with:
 * - CORS
 * - Error handling
 * - Request logging
 * - Route registration
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { errorHandler } from "./middleware/error.middleware";
import { decisionsRoutes } from "./modules/decisions/decisions.routes";
import { usersRoutes } from "./modules/users/users.routes";
import { adminsRoutes } from "./modules/admins/admins.routes";
import { leadsRoutes } from "./modules/leads/leads.routes";

export function buildApp() {
  const app = new Hono();

  const ALLOWED_ORIGINS = [
    "https://app.contextgrade.com",
    "https://admin.contextgrade.com",
    "https://contextgrade.com",
  ];

  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (env.NODE_ENV !== "production") return origin;
        return ALLOWED_ORIGINS.includes(origin) ? origin : "";
      },
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
      allowHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-API-Key"],
      credentials: true,
      maxAge: 86400,
    }),
  );

  app.use("*", requestId());

  app.use("*", async (c, next) => {
    logger.debug("Incoming request", {
      method: c.req.method,
      url: c.req.url,
      requestId: c.get("requestId"),
    });

    await next();

    logger.info("Request completed", {
      method: c.req.method,
      url: c.req.url,
      statusCode: c.res.status,
      requestId: c.get("requestId"),
    });
  });

  app.onError(errorHandler);

  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      service: "contextgrade",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
    });
  });

  app.route("/api/v1", decisionsRoutes);
  app.route("/api/v1", usersRoutes);
  app.route("/api/v1", adminsRoutes);
  app.route("/api/v1", leadsRoutes);

  logger.info("Application configured", {
    environment: env.NODE_ENV,
    port: env.PORT,
  });

  return app;
}
