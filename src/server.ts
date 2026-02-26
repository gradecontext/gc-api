/**
 * Server Entry Point (Node.js)
 *
 * Starts the Fastify HTTP server for local development.
 * For Cloudflare Workers deployment, see src/worker.ts.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { initPrisma, prisma, disconnectPrisma } from "./db/client";
import { buildApp } from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
initPrisma(
  new PrismaClient({ adapter }),
  async () => {
    await pool.end();
    logger.info("Connection pool closed");
  },
);

async function start() {
  try {
    const app = await buildApp();

    await app.listen({
      port: parseInt(env.PORT, 10),
      host: env.HOST,
    });

    logger.info(`Server listening on http://${env.HOST}:${env.PORT}`);

    try {
      await prisma.$queryRaw`SELECT 1`;
      logger.info("Database connection established");
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      logger.error("Database connection failed", {
        message: errorObj.message,
        stack: errorObj.stack,
      });
    }
  } catch (error) {
    const errorObj =
      error instanceof Error ? error : new Error(String(error));
    logger.error("Failed to start server", {
      message: errorObj.message,
      stack: errorObj.stack,
    });
    process.exit(1);
  }
}

const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  try {
    await disconnectPrisma();
    process.exit(0);
  } catch (error) {
    logger.error(
      "Error during shutdown",
      error instanceof Error ? error : new Error(String(error)),
    );
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", {
    message: String(reason),
    promise: String(promise),
  });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", error);
  process.exit(1);
});

start();
