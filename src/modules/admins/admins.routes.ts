/**
 * Admins Routes
 * Hono route definitions for admin endpoints
 */

import { Hono } from "hono";
import {
  createAdminHandler,
  listAdminsHandler,
  getAdminHandler,
  updateAdminHandler,
  deleteAdminHandler,
} from "./admins.controller";
import { authenticate } from "../../middleware/auth.middleware";

const admins = new Hono();

admins.use("*", authenticate);

admins.post("/admins", createAdminHandler);
admins.get("/admins", listAdminsHandler);
admins.get("/admins/:id", getAdminHandler);
admins.patch("/admins/:id", updateAdminHandler);
admins.delete("/admins/:id", deleteAdminHandler);

export { admins as adminsRoutes };
