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
 *
 * A fresh Pool/PrismaClient is created per request (see fetch() below)
 * rather than cached as a module-level singleton. Workers isolates are
 * reused across many requests; a single shared pool meant concurrent
 * requests on the same isolate contended over one connection, causing
 * intermittent "timeout exceeded when trying to connect" failures under
 * load. Request-scoped clients (via runWithPrisma/AsyncLocalStorage in
 * db/client.ts) avoid that contention.
 */

import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { runWithPrisma } from "./db/client";
import { buildApp } from "./app";
import { logger } from "./utils/logger";

interface WorkerEnv {
  HYPERDRIVE?: Hyperdrive;
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

const app = buildApp();

export default {
  async fetch(
    request: Request,
    workerEnv: WorkerEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    populateProcessEnv(workerEnv);

    // Use Hyperdrive when bound (preferred — local proxy, faster).
    // Fall back to DATABASE_URL for direct Supabase Supavisor connection.
    const connectionString = workerEnv.HYPERDRIVE?.connectionString ?? workerEnv.DATABASE_URL;
    if (!connectionString) {
      throw new Error("No database connection: configure the HYPERDRIVE binding or set the DATABASE_URL secret");
    }

    const pool = new Pool({ connectionString, connectionTimeoutMillis: 10_000 });
    pool.on("error", (err) => {
      logger.error("Postgres pool error", err instanceof Error ? err : new Error(String(err)));
    });
    const adapter = new PrismaPg(pool);
    const client = new PrismaClient({ adapter });

    return runWithPrisma(client, () => app.fetch(request, workerEnv, ctx));
  },
};
