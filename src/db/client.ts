/**
 * Prisma database client — runtime-agnostic singleton
 *
 * The actual PrismaClient is created by the entry point (server.ts or
 * worker.ts) and injected via initPrisma(). This keeps the db module
 * free of engine-specific imports so it works in both Node.js and
 * Cloudflare Workers without WASM/binary conflicts.
 */

import type { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

// Both generators (prisma-client-js and prisma-client with runtime=cloudflare)
// produce structurally identical but nominally different PrismaClient types.
// We accept any compatible client instance here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _prisma: any;
let _cleanup: (() => Promise<void>) | undefined;

/**
 * Inject a ready-to-use PrismaClient.
 * Called by src/server.ts (binary engine) or src/worker.ts (WASM engine).
 */
export function initPrisma(
  client: unknown,
  cleanup?: () => Promise<void>,
): void {
  _prisma = client;
  _cleanup = cleanup;
}

/**
 * Lazy proxy — forwards every property access to the injected client.
 * Throws immediately if accessed before initPrisma() is called.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_, prop) {
    if (!_prisma) {
      throw new Error(
        "Prisma client not initialized. Call initPrisma() in the entry point before handling requests.",
      );
    }
    const value = (_prisma as any)[prop];
    if (typeof value === "function") {
      return value.bind(_prisma);
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
