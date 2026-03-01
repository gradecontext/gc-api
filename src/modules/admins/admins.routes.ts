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

admins.post("/admins", authenticate, createAdminHandler);
admins.get("/admins", authenticate, listAdminsHandler);
admins.get("/admins/:id", authenticate, getAdminHandler);
admins.patch("/admins/:id", authenticate, updateAdminHandler);
admins.delete("/admins/:id", authenticate, deleteAdminHandler);

export { admins as adminsRoutes };
