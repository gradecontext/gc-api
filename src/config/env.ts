/**
 * Environment configuration
 * Validates and exports typed environment variables
 */

import { z } from "zod";

const envSchema = z.object({
  // Server
  PORT: z.string().default("3000"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  HOST: z.string().default("0.0.0.0"),

  // Database
  DATABASE_URL: z.string().url(),

  // AI Service
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Auth (API Key for now)
  API_KEY: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

type Env = z.infer<typeof envSchema>;

function getEnv(): Env {
  const rawEnv = {
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    HOST: process.env.HOST,
    DATABASE_URL: process.env.DATABASE_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    API_KEY: process.env.API_KEY,
    LOG_LEVEL: process.env.LOG_LEVEL,
  };

  try {
    return envSchema.parse(rawEnv);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid environment variables:\n${error.errors
          .map((e) => `  ${e.path.join(".")}: ${e.message}`)
          .join("\n")}`
      );
    }
    throw error;
  }
}

export const env = getEnv();
