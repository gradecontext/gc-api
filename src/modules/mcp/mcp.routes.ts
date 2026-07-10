/**
 * MCP transport wiring — mounts a stateless Streamable HTTP MCP endpoint at /mcp.
 *
 * Stateless (sessionIdGenerator: undefined) because Cloudflare Workers isolates
 * aren't guaranteed to survive between requests, and these tools are read-only
 * with no need for server-initiated notifications between calls. A fresh
 * McpServer + transport pair is built per request rather than shared at module
 * scope — this is also what keeps the clientId scoping in mcp.server.ts safe
 * under concurrent requests from different clients hitting the same Worker
 * isolate.
 *
 * Auth uses `authenticateMcp` — a dedicated middleware that only accepts a
 * client's mcpApiKey (see auth.middleware.ts), never the general-purpose
 * apiKey and never the master API key. That's what makes the separate MCP
 * key meaningful: it can't be used against /api/v1/*, and the REST apiKey
 * can't be used here, so revoking one doesn't touch the other.
 */

import { Context, Hono } from 'hono';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { authenticateMcp } from '../../middleware/auth.middleware';
import { logger } from '../../utils/logger';
import { createMcpServer } from './mcp.server';

const mcp = new Hono();

mcp.all('/mcp', authenticateMcp, async (c: Context) => {
  const clientId = c.get('clientId') as number | undefined;

  if (!clientId) {
    return c.json(
      {
        error: 'Bad Request',
        message:
          'Client context required. Authenticate with a client-scoped X-API-Key (the master API key is not accepted here).',
      },
      400,
    );
  }

  const server = createMcpServer(clientId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  server.server.onerror = (error) => {
    logger.error('MCP server error', { clientId, error: error.message, stack: error.stack });
  };

  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
});

export { mcp as mcpRoutes };
