/**
 * Memberships Controller
 * Request/response handling for membership endpoints
 */

import { Context } from "hono";
import { z } from "zod";
import { logger } from "../../utils/logger";
import {
  approveMembership,
  rejectMembership,
  changeMembershipRole,
  removeMembership,
  listClientMembers,
  listUserMemberships,
} from "./memberships.service";

const roleValues = ["OWNER", "ADMIN", "APPROVER", "VIEWER"] as const;
const statusFilter = ["PENDING", "ACTIVE", "REJECTED"] as const;

/**
 * GET /memberships/me — list the authenticated user's memberships
 */
export async function listMyMembershipsHandler(c: Context) {
  try {
    const userId = c.get("userId") as number | undefined;
    if (!userId) {
      return c.json(
        { error: "Unauthorized", message: "You must be a registered user" },
        401,
      );
    }

    const memberships = await listUserMemberships(userId);
    return c.json({ success: true, data: memberships }, 200);
  } catch (error) {
    logger.error(
      "Error listing user memberships",
      error instanceof Error ? error : new Error(String(error)),
    );
    throw error;
  }
}

/**
 * GET /memberships/client/:clientId — list members of a client
 */
export async function listClientMembersHandler(c: Context) {
  try {
    const userId = c.get("userId") as number | undefined;
    if (!userId) {
      return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
    }

    const clientId = parseInt(c.req.param("clientId"), 10);
    if (isNaN(clientId)) {
      return c.json({ error: "Bad Request", message: "Invalid client ID" }, 400);
    }

    const statusParam = c.req.query("status") as string | undefined;
    let status: "PENDING" | "ACTIVE" | "REJECTED" | undefined;
    if (statusParam) {
      const parsed = z.enum(statusFilter).safeParse(statusParam);
      if (!parsed.success) {
        return c.json({ error: "Bad Request", message: "Invalid status filter" }, 400);
      }
      status = parsed.data;
    }

    const memberships = await listClientMembers(clientId, status);
    return c.json({ success: true, data: memberships }, 200);
  } catch (error) {
    logger.error(
      "Error listing client members",
      error instanceof Error ? error : new Error(String(error)),
    );
    throw error;
  }
}

/**
 * PATCH /memberships/:id/approve
 */
export async function approveMembershipHandler(c: Context) {
  try {
    const userId = c.get("userId") as number | undefined;
    if (!userId) {
      return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
    }

    const membershipId = parseInt(c.req.param("id"), 10);
    if (isNaN(membershipId)) {
      return c.json({ error: "Bad Request", message: "Invalid membership ID" }, 400);
    }

    const membership = await approveMembership(membershipId, userId);
    return c.json({ success: true, message: "Membership approved", data: membership }, 200);
  } catch (error) {
    return handleMembershipError(c, error, "approving membership");
  }
}

/**
 * PATCH /memberships/:id/reject
 */
export async function rejectMembershipHandler(c: Context) {
  try {
    const userId = c.get("userId") as number | undefined;
    if (!userId) {
      return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
    }

    const membershipId = parseInt(c.req.param("id"), 10);
    if (isNaN(membershipId)) {
      return c.json({ error: "Bad Request", message: "Invalid membership ID" }, 400);
    }

    const membership = await rejectMembership(membershipId, userId);
    return c.json({ success: true, message: "Membership rejected", data: membership }, 200);
  } catch (error) {
    return handleMembershipError(c, error, "rejecting membership");
  }
}

/**
 * PATCH /memberships/:id/role
 */
export async function changeRoleHandler(c: Context) {
  try {
    const userId = c.get("userId") as number | undefined;
    if (!userId) {
      return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
    }

    const membershipId = parseInt(c.req.param("id"), 10);
    if (isNaN(membershipId)) {
      return c.json({ error: "Bad Request", message: "Invalid membership ID" }, 400);
    }

    const body = z.object({ role: z.enum(roleValues) }).parse(await c.req.json());

    const membership = await changeMembershipRole(membershipId, body.role, userId);
    return c.json({ success: true, message: "Role updated", data: membership }, 200);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { error: "Validation Error", message: "Invalid request body", details: error.errors },
        400,
      );
    }
    return handleMembershipError(c, error, "changing role");
  }
}

/**
 * DELETE /memberships/:id
 */
export async function removeMembershipHandler(c: Context) {
  try {
    const userId = c.get("userId") as number | undefined;
    if (!userId) {
      return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
    }

    const membershipId = parseInt(c.req.param("id"), 10);
    if (isNaN(membershipId)) {
      return c.json({ error: "Bad Request", message: "Invalid membership ID" }, 400);
    }

    await removeMembership(membershipId, userId);
    return c.json({ success: true, message: "Membership removed" }, 200);
  } catch (error) {
    return handleMembershipError(c, error, "removing membership");
  }
}

// ── shared error handler ──

function handleMembershipError(c: Context, error: unknown, action: string) {
  if (error instanceof Error) {
    const errorMap: Record<string, number> = {
      "Membership not found": 404,
      "Only PENDING memberships can be approved": 400,
      "Only PENDING memberships can be rejected": 400,
      "Not a member of this organization": 403,
      "Your membership is not active": 403,
      "Only admins can perform this action": 403,
      "Cannot demote the last admin of this organization": 400,
    };

    const statusCode = errorMap[error.message];
    if (statusCode) {
      const label = statusCode === 404 ? "Not Found" : statusCode === 403 ? "Forbidden" : "Bad Request";
      return c.json({ error: label, message: error.message }, statusCode as any);
    }
  }

  logger.error(
    `Error ${action}`,
    error instanceof Error ? error : new Error(String(error)),
  );
  throw error;
}
