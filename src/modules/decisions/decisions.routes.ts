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

decisions.use("*", authenticate);

decisions.post("/decisions", createDecisionHandler);
decisions.post("/decisions/:id/review", reviewDecisionHandler);
decisions.get("/decisions/:id", getDecisionHandler);

export { decisions as decisionsRoutes };
