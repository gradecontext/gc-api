/**
 * Cloudflare Workers Entry Point
 *
 * Hono natively supports Cloudflare Workers — no inject() bridge needed.
 *
 * Database access uses @prisma/adapter-pg which creates a pg Pool lazily
 * on first query. The connection goes through Supabase's Supavisor pooler
 * over TCP, supported by Workers' nodejs_compat flag.
 *
 * Uses the "worker" Prisma generator (WASM engine, runtime = "cloudflare")
 * so the query engine runs inside the V8 isolate.
 */

import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { initPrisma } from "./db/client";
import { buildApp } from "./app";

interface WorkerEnv {
  HYPERDRIVE: Hyperdrive;
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

let initialized = false;

function ensureInitialized(workerEnv: WorkerEnv): void {
  if (initialized) return;

  populateProcessEnv(workerEnv);

  const adapter = new PrismaPg({
    connectionString: workerEnv.HYPERDRIVE.connectionString,
  });

  const client = new PrismaClient({ adapter });
  initPrisma(client);

  initialized = true;
}

const app = buildApp();

export default {
  async fetch(
    request: Request,
    workerEnv: WorkerEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    ensureInitialized(workerEnv);
    return app.fetch(request, workerEnv, ctx);
  },
};
