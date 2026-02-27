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

leads.use("*", authenticate);

leads.post("/leads", createLeadHandler);
leads.get("/leads", listLeadsHandler);
leads.get("/leads/:id", getLeadHandler);
leads.patch("/leads/:id", updateLeadHandler);

export { leads as leadsRoutes };
