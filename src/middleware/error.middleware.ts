/**
 * Centralized error handling middleware
 * Catches all errors and formats consistent error responses
 */

import { Context } from "hono";
import { ZodError } from "zod";
import { logger } from "../utils/logger";
import { env } from "../config/env";

interface ErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

interface PrismaKnownError {
  code: string;
  message: string;
  meta?: unknown;
  clientVersion: string;
}

function isPrismaKnownError(error: unknown): error is PrismaKnownError {
  return (
    error instanceof Error &&
    "code" in error &&
    "clientVersion" in error &&
    typeof (error as any).code === "string"
  );
}

function formatPrismaError(error: PrismaKnownError): ErrorResponse {
  switch (error.code) {
    case "P2002":
      return {
        error: "Conflict",
        message: "A record with this unique constraint already exists",
        details: error.meta,
      };
    case "P2025":
      return {
        error: "Not Found",
        message: "The requested record was not found",
      };
    default:
      return {
        error: "Database Error",
        message: "A database operation failed",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      };
  }
}

function formatZodError(error: ZodError): ErrorResponse {
  return {
    error: "Validation Error",
    message: "Request validation failed",
    details: error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    })),
  };
}

/**
 * Hono global error handler — registered via app.onError()
 */
export function errorHandler(error: Error, c: Context) {
  logger.error("Request error", {
    message: error.message,
    stack: error.stack,
    method: c.req.method,
    url: c.req.url,
  });

  let response: ErrorResponse;
  let statusCode: 400 | 404 | 409 | 500 = 500;

  if (error instanceof ZodError) {
    response = formatZodError(error);
    statusCode = 400;
  } else if (isPrismaKnownError(error)) {
    response = formatPrismaError(error);
    statusCode = error.code === "P2025" ? 404 : 409;
  } else {
    response = {
      error: "Internal Server Error",
      message:
        env.NODE_ENV === "development"
          ? error.message
          : "An unexpected error occurred",
      details: env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }

  return c.json(response, statusCode);
}
