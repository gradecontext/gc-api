/**
 * Cloudflare Workers Entry Point
 *
 * Routes fetch events through Fastify's inject() API (no node:http needed).
 *
 * Database access uses @prisma/adapter-pg which internally creates a pg Pool
 * lazily on first query — after Fastify has finished initializing. The
 * connection goes through Supabase's Supavisor pooler over TCP, supported
 * by Workers' nodejs_compat flag (node:net + node:tls).
 *
 * Uses the "worker" Prisma generator (WASM engine, runtime = "cloudflare")
 * so the query engine runs inside the V8 isolate.
 */

import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { initPrisma } from "./db/client";
import { buildApp } from "./app";
import type { FastifyInstance } from "fastify";

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

let fastifyApp: FastifyInstance | null = null;
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

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Timeout: ${label} took longer than ${ms}ms`)),
      ms,
    ),
  );
  return Promise.race([promise, timeout]);
}

async function initializeApp(workerEnv: WorkerEnv): Promise<void> {
  const adapter = new PrismaPg({
    connectionString: workerEnv.HYPERDRIVE.connectionString, // <-- use this
  });
  const client = new PrismaClient({ adapter });
  initPrisma(client);

  const app = await buildApp({ pluginTimeout: 0 });
  await app.ready();
  fastifyApp = app;
}

export default {
  async fetch(
    request: Request,
    workerEnv: WorkerEnv,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    populateProcessEnv(workerEnv);

    if (!appReady) {
      appReady = withTimeout(
        initializeApp(workerEnv),
        25_000,
        "initializeApp",
      ).catch((err) => {
        appReady = null;
        throw err;
      });
    }
    await appReady;

    const url = new URL(request.url);

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    const payload = hasBody
      ? Buffer.from(await request.arrayBuffer())
      : undefined;

    const res = await fastifyApp!.inject({
      method: request.method as
        | "GET"
        | "POST"
        | "PUT"
        | "PATCH"
        | "DELETE"
        | "HEAD"
        | "OPTIONS",
      url: url.pathname + url.search,
      headers,
      payload,
    });

    const responseHeaders = new Headers();
    for (const [key, value] of Object.entries(res.headers)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) responseHeaders.append(key, String(v));
      } else {
        responseHeaders.set(key, String(value));
      }
    }

    return new Response(res.rawPayload, {
      status: res.statusCode,
      headers: responseHeaders,
    });
  },
};
