/**
 * Leads Routes
 * Hono route definitions for lead endpoints
 */

import { Hono } from "hono";
import {
  createLeadHandler,
  listLeadsHandler,
  getLeadHandler,
  updateLeadHandler,
} from "./leads.controller";
import { authenticate } from "../../middleware/auth.middleware";

const leads = new Hono();

leads.post("/leads", authenticate, createLeadHandler);
leads.get("/leads", authenticate, listLeadsHandler);
leads.get("/leads/:id", authenticate, getLeadHandler);
leads.patch("/leads/:id", authenticate, updateLeadHandler);

export { leads as leadsRoutes };
