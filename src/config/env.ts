/**
 * Environment configuration
 *
 * Uses a lazy Proxy so process.env is read on first property access,
 * not at module load time. This is required for Cloudflare Workers where
 * process.env is populated from bindings inside the fetch handler,
 * after all static imports have executed.
 */

import { z } from "zod";

const envSchema = z.object({
  // Server
  PORT: z.string().default("8080"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  HOST: z.string().default("0.0.0.0"),

  // Database
  DATABASE_URL: z.string().url(),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_DEFAULT_KEY: z.string(),
  SUPABASE_SECRET_KEY: z.string().optional(),

  // AI Service
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Auth (API Key for B2B client authentication)
  API_KEY: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

type Env = z.infer<typeof envSchema>;

let _parsed: Env | null = null;

function parseEnv(): Env {
  const rawEnv = {
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    HOST: process.env.HOST,
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_DEFAULT_KEY:
      process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
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
          .join("\n")}`,
      );
    }
    throw error;
  }
}

/**
 * Lazy environment — validated on first property access.
 * Safe for both Node.js (dotenv loads before first use) and
 * Cloudflare Workers (bindings populate process.env in fetch handler).
 */
export const env: Env = new Proxy({} as Env, {
  get(_, prop: string) {
    if (!_parsed) {
      _parsed = parseEnv();
    }
    return _parsed[prop as keyof Env];
  },
});
