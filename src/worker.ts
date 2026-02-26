/**
 * Cloudflare Workers Entry Point
 *
 * Bridges incoming fetch events to the Fastify HTTP server using
 * Cloudflare's node:http compatibility layer (requires nodejs_compat
 * flag and compatibility_date >= 2025-08-15).
 *
 * Uses the "worker" Prisma generator (WASM engine, runtime = "cloudflare")
 * so the query engine runs inside the V8 isolate.
 */

import { handleAsNodeRequest } from "cloudflare:node";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { initPrisma } from "./db/client";
import { buildApp } from "./app";

const PORT = 8080;

interface WorkerEnv {
  [key: string]: unknown;
  DATABASE_URL: string;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_DEFAULT_KEY: string;
  SUPABASE_SECRET_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  API_KEY?: string;
  NODE_ENV?: string;
  LOG_LEVEL?: string;
  PORT?: string;
  HOST?: string;
}

let appReady: Promise<void> | null = null;

const KNOWN_ENV_KEYS = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_DEFAULT_KEY",
  "SUPABASE_SECRET_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "API_KEY",
  "NODE_ENV",
  "LOG_LEVEL",
  "PORT",
  "HOST",
] as const;

function populateProcessEnv(workerEnv: WorkerEnv): void {
  for (const key of KNOWN_ENV_KEYS) {
    const value = workerEnv[key];
    if (typeof value === "string") {
      process.env[key] = value;
    }
  }
}

async function initializeApp(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  initPrisma(new PrismaClient({ adapter }), async () => {
    await pool.end();
  });

  // Disable pluginTimeout — Workers cold-start latency is unpredictable and
  // easily exceeds Fastify's default 10 s limit.
  const app = await buildApp({ pluginTimeout: 0 });

  // Finalize plugins first, then register the server with the Workers
  // node:http compat layer separately. Using the combined `app.listen()`
  // can hang on Workers because the underlying `server.listen()` callback
  // may not fire in the expected tick.
  await app.ready();
  app.server.listen(PORT, "0.0.0.0");
}

export default {
  async fetch(
    request: Request,
    workerEnv: WorkerEnv,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    populateProcessEnv(workerEnv);

    if (!appReady) {
      appReady = initializeApp().catch((err) => {
        appReady = null; // allow retry on the next request
        throw err;
      });
    }
    await appReady;

    return handleAsNodeRequest(PORT, request);
  },
};
