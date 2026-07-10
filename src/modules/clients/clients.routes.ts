/**
 * Clients Routes
 * Hono route definitions for client endpoints
 */

import { Hono } from "hono";
import { searchClientsByNameHandler, getMcpApiKeyHandler } from "./clients.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";

const clients = new Hono();
const adminRoles = requireRole("ADMIN");

clients.get("/clients/search", authenticate, searchClientsByNameHandler);
clients.get("/clients/mcp-key", authenticate, adminRoles, getMcpApiKeyHandler);

export { clients as clientsRoutes };
