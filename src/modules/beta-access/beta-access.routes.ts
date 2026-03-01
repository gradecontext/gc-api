/**
 * Beta Access List Routes
 * Hono route definitions for beta access endpoints
 */

import { Hono } from "hono";
import {
  createBetaAccessHandler,
  listBetaAccessHandler,
  getBetaAccessHandler,
  updateBetaAccessHandler,
} from "./beta-access.controller";
import { authenticate } from "../../middleware/auth.middleware";

const betaAccess = new Hono();

// Public — no auth
betaAccess.post("/beta-access", createBetaAccessHandler);

// Protected — auth required
betaAccess.get("/beta-access", authenticate, listBetaAccessHandler);
betaAccess.get("/beta-access/:id", authenticate, getBetaAccessHandler);
betaAccess.patch("/beta-access/:id", authenticate, updateBetaAccessHandler);

export { betaAccess as betaAccessRoutes };
