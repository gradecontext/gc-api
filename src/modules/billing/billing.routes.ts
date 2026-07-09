/**
 * Billing Routes
 * Hono route definitions for subscription billing management.
 *
 * All routes require authentication + ADMIN role. This codebase's membership
 * model only has ADMIN/STAFF (see 20260626120000_simplify_user_roles_to_admin_staff);
 * ADMIN is the equivalent of the "OWNER or ADMIN" gate billing typically needs.
 */

import { Hono } from "hono";
import { authenticate } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import {
  getBillingHandler,
  getPlansHandler,
  createCheckoutHandler,
  getPortalHandler,
  getPreviewHandler,
  cancelBillingHandler,
  reactivateBillingHandler,
} from "./billing.controller";

const billing = new Hono();
const adminOnly = requireRole("ADMIN");

billing.get("/billing", authenticate, adminOnly, getBillingHandler);
billing.get("/billing/plans", authenticate, adminOnly, getPlansHandler);
billing.post("/billing/checkout", authenticate, adminOnly, createCheckoutHandler);
billing.get("/billing/portal", authenticate, adminOnly, getPortalHandler);
billing.get("/billing/preview", authenticate, adminOnly, getPreviewHandler);
billing.post("/billing/cancel", authenticate, adminOnly, cancelBillingHandler);
billing.post("/billing/reactivate", authenticate, adminOnly, reactivateBillingHandler);

export { billing as billingRoutes };
