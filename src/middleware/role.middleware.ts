/**
 * Role enforcement middleware
 *
 * Gates routes by the caller's per-client membership role (set by `authenticate`
 * on `c.set("membershipRole", ...)` when the caller authenticated via Supabase JWT).
 *
 * API-key callers (master key or per-client B2B key) never get a `membershipRole` —
 * they're trusted server-to-server integrations, not a specific staff member, so
 * they're allowed through unconditionally. This only restricts human (JWT) sessions.
 */

import { MiddlewareHandler } from "hono";
import { logger } from "../utils/logger";

export function requireRole(...roles: string[]): MiddlewareHandler {
  return async (c, next) => {
    const membershipRole = c.get("membershipRole") as string | undefined;

    if (!membershipRole) {
      return next();
    }

    if (!roles.includes(membershipRole)) {
      logger.warn("Role check failed", {
        membershipRole,
        required: roles,
        path: c.req.path,
      });
      return c.json(
        { error: "Forbidden", message: `This action requires one of the following roles: ${roles.join(", ")}` },
        403,
      );
    }

    return next();
  };
}
