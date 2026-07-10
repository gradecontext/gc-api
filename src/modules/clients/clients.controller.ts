/**
 * Clients Controller
 * Request/response handling for client endpoints
 */

import { Context } from "hono";
import { logger } from "../../utils/logger";
import { searchClientsByName, getClientMcpApiKey } from "./clients.service";

export async function searchClientsByNameHandler(c: Context) {
  try {
    const name = c.req.query("name");
    if (!name || name.trim().length === 0) {
      return c.json(
        { error: "Bad Request", message: "Query parameter 'name' is required" },
        400,
      );
    }

    const page = c.req.query("page");
    const limit = c.req.query("limit");

    const result = await searchClientsByName(
      name.trim(),
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );

    return c.json(
      {
        success: true,
        data: result.clients,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          pages: Math.ceil(result.total / result.limit),
        },
      },
      200,
    );
  } catch (error) {
    logger.error("Error searching clients by name", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

// Backs the "MCP Integration" settings panel — read-only, copy-to-clipboard.
// No rotate/update path yet.
export async function getMcpApiKeyHandler(c: Context) {
  try {
    const clientId = c.get("clientId") as number | undefined;
    if (!clientId) {
      return c.json({ error: "Bad Request", message: "Client context required." }, 400);
    }

    const mcpApiKey = await getClientMcpApiKey(clientId);
    return c.json({ mcp_api_key: mcpApiKey }, 200);
  } catch (error) {
    logger.error("Error fetching MCP API key", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
