/**
 * Centralized error handling middleware
 * Catches all errors and formats consistent error responses
 */

import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { env } from '../config/env';

interface ErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

/**
 * Format Prisma errors into user-friendly messages
 */
function formatPrismaError(error: Prisma.PrismaClientKnownRequestError): ErrorResponse {
  switch (error.code) {
    case 'P2002':
      return {
        error: 'Conflict',
        message: 'A record with this unique constraint already exists',
        details: error.meta,
      };
    case 'P2025':
      return {
        error: 'Not Found',
        message: 'The requested record was not found',
      };
    default:
      return {
        error: 'Database Error',
        message: 'A database operation failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      };
  }
}

/**
 * Format Zod validation errors
 */
function formatZodError(error: ZodError): ErrorResponse {
  return {
    error: 'Validation Error',
    message: 'Request validation failed',
    details: error.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    })),
  };
}

/**
 * Global error handler
 * Catches all unhandled errors and formats responses
 */
export async function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  logger.error('Request error', {
    message: errorObj.message,
    stack: errorObj.stack,
    method: request.method,
    url: request.url,
    statusCode: 'statusCode' in error ? error.statusCode : 500,
  });

  let response: ErrorResponse;
  let statusCode = 500;

  // Handle known error types
  if (error instanceof ZodError) {
    response = formatZodError(error);
    statusCode = 400;
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    response = formatPrismaError(error);
    statusCode = error.code === 'P2025' ? 404 : 409;
  } else if ('statusCode' in error && typeof error.statusCode === 'number') {
    // Fastify error with status code
    statusCode = error.statusCode;
    response = {
      error: error.name || 'Error',
      message: error.message || 'An error occurred',
    };
  } else {
    // Unknown error - never expose internal details in production
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    response = {
      error: 'Internal Server Error',
      message: env.NODE_ENV === 'development' ? errorMessage : 'An unexpected error occurred',
      details: env.NODE_ENV === 'development' ? errorStack : undefined,
    };
  }

  reply.code(statusCode).send(response);
}
