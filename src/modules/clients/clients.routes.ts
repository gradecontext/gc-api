/**
 * Clients Routes
 * Hono route definitions for client endpoints
 */

import { Hono } from "hono";
import { searchClientsByNameHandler } from "./clients.controller";
import { authenticate } from "../../middleware/auth.middleware";

const clients = new Hono();

clients.get("/clients/search", authenticate, searchClientsByNameHandler);

export { clients as clientsRoutes };
