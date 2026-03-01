/**
 * Decisions Routes
 * Hono route definitions for decision endpoints
 */

import { Hono } from "hono";
import {
  createDecisionHandler,
  reviewDecisionHandler,
  getDecisionHandler,
} from "./decisions.controller";
import { authenticate } from "../../middleware/auth.middleware";

const decisions = new Hono();

decisions.post("/decisions", authenticate, createDecisionHandler);
decisions.post("/decisions/:id/review", authenticate, reviewDecisionHandler);
decisions.get("/decisions/:id", authenticate, getDecisionHandler);

export { decisions as decisionsRoutes };
