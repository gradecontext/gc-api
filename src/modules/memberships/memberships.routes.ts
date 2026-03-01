/**
 * Memberships Routes
 * Hono route definitions for membership management
 *
 * All routes require authentication (session or API key).
 */

import { Hono } from "hono";
import {
  listMyMembershipsHandler,
  listClientMembersHandler,
  approveMembershipHandler,
  rejectMembershipHandler,
  changeRoleHandler,
  removeMembershipHandler,
} from "./memberships.controller";
import { authenticate } from "../../middleware/auth.middleware";

const memberships = new Hono();

memberships.get("/memberships/me", authenticate, listMyMembershipsHandler);
memberships.get(
  "/memberships/client/:clientId",
  authenticate,
  listClientMembersHandler,
);
memberships.patch(
  "/memberships/:id/approve",
  authenticate,
  approveMembershipHandler,
);
memberships.patch(
  "/memberships/:id/reject",
  authenticate,
  rejectMembershipHandler,
);
memberships.patch("/memberships/:id/role", authenticate, changeRoleHandler);
memberships.delete("/memberships/:id", authenticate, removeMembershipHandler);

export { memberships as membershipsRoutes };
