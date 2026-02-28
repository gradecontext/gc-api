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

memberships.use("*", authenticate);

memberships.get("/memberships/me", listMyMembershipsHandler);
memberships.get("/memberships/client/:clientId", listClientMembersHandler);
memberships.patch("/memberships/:id/approve", approveMembershipHandler);
memberships.patch("/memberships/:id/reject", rejectMembershipHandler);
memberships.patch("/memberships/:id/role", changeRoleHandler);
memberships.delete("/memberships/:id", removeMembershipHandler);

export { memberships as membershipsRoutes };
