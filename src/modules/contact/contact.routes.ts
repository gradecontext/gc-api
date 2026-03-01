/**
 * Contact Messages Routes
 * Hono route definitions for contact message endpoints
 */

import { Hono } from "hono";
import {
  createContactHandler,
  listContactsHandler,
  getContactHandler,
  updateContactHandler,
} from "./contact.controller";
import { authenticate } from "../../middleware/auth.middleware";

const contact = new Hono();

// Public — no auth
contact.post("/contact", createContactHandler);

// Protected — auth required
contact.get("/contact", authenticate, listContactsHandler);
contact.get("/contact/:id", authenticate, getContactHandler);
contact.patch("/contact/:id", authenticate, updateContactHandler);

export { contact as contactRoutes };
