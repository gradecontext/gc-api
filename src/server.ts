/**
 * Server Entry Point
 * 
 * Starts the Fastify HTTP server
 * Handles graceful shutdown
 */

import { buildApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { prisma } from './db/client';

async function start() {
  try {
    // Build application
    const app = await buildApp();

    // Start server
    await app.listen({
      port: parseInt(env.PORT, 10),
      host: env.HOST,
    });

    logger.info(`🚀 Server listening on http://${env.HOST}:${env.PORT}`);

    // Test database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      logger.info('✅ Database connection established');
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('❌ Database connection failed', {
        message: errorObj.message,
        stack: errorObj.stack,
      });
    }
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to start server', {
      message: errorObj.message,
      stack: errorObj.stack,
    });
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    await prisma.$disconnect();
    logger.info('Database disconnected');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    message: String(reason),
    promise: String(promise),
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  process.exit(1);
});

// Start the server
start();
