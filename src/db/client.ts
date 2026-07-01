/**
 * Prisma database client — runtime-agnostic access point
 *
 * src/server.ts (long-lived Node process) injects one client for the whole
 * process via initPrisma() — safe there since there's no isolate reuse.
 *
 * src/worker.ts (Cloudflare Workers) instead scopes a fresh client to each
 * request via runWithPrisma() + AsyncLocalStorage. A module-level singleton
 * pool previously caused intermittent "timeout exceeded when trying to
 * connect" failures under concurrent requests: Workers isolates are reused
 * across many requests, and a single shared max:1 pg.Pool meant concurrent
 * requests on the same isolate contended for one connection. Request-scoped
 * clients avoid that contention entirely.
 *
 * This keeps the db module free of engine-specific imports so it works in
 * both Node.js and Cloudflare Workers without WASM/binary conflicts.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

// Both generators (prisma-client-js and prisma-client with runtime=cloudflare)
// produce structurally identical but nominally different PrismaClient types.
// We accept any compatible client instance here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const requestStorage = new AsyncLocalStorage<any>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _prisma: any;
let _cleanup: (() => Promise<void>) | undefined;

/**
 * Inject a ready-to-use PrismaClient for the lifetime of the process.
 * Called by src/server.ts (binary engine).
 */
export function initPrisma(
  client: unknown,
  cleanup?: () => Promise<void>,
): void {
  _prisma = client;
  _cleanup = cleanup;
}

/**
 * Run `fn` with `client` as the active Prisma client for the duration of
 * the async call chain — including anything awaited inside `fn`, even
 * across concurrent requests on the same Workers isolate. Called once per
 * request by src/worker.ts.
 */
export function runWithPrisma<T>(client: unknown, fn: () => T): T {
  return requestStorage.run(client, fn);
}

/**
 * Lazy proxy — forwards every property access to the active client:
 * the request-scoped client set via runWithPrisma() if present, otherwise
 * the process-wide client set via initPrisma().
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_, prop) {
    const client = requestStorage.getStore() ?? _prisma;
    if (!client) {
      throw new Error(
        "Prisma client not initialized. Call initPrisma() or runWithPrisma() before handling requests.",
      );
    }
    const value = (client as any)[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});

export async function disconnectPrisma(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = undefined;
    logger.info("Prisma client disconnected");
  }
  if (_cleanup) {
    await _cleanup();
    _cleanup = undefined;
  }
}
