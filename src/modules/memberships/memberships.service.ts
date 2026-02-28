/**
 * Memberships Service
 * Business logic for membership approval, role changes, and listing.
 *
 * Key rule: only ACTIVE ADMIN/OWNER members of a client can approve, reject,
 * or change roles of other memberships within that client.
 */

import { logger } from "../../utils/logger";
import { prisma } from "../../db/client";
import {
  findMembershipById,
  findMembershipsByClient,
  findMembershipsByUser,
  updateMembershipStatus,
  updateMembershipRole,
  deleteMembership,
  findMembershipByUserAndClient,
} from "./memberships.repository";
import { createNotification } from "../notifications/notifications.repository";
import { MembershipDetailResponse } from "./memberships.types";
import { MembershipStatus, UserRole } from "@prisma/client";

/**
 * Approve a pending membership.
 * Only callable by an ACTIVE ADMIN/OWNER of the same client.
 */
export async function approveMembership(
  membershipId: number,
  actingUserId: number,
): Promise<MembershipDetailResponse> {
  const membership = await findMembershipById(membershipId);
  if (!membership) throw new Error("Membership not found");
  if (membership.status !== "PENDING") {
    throw new Error("Only PENDING memberships can be approved");
  }

  await assertCallerIsAdmin(actingUserId, membership.clientId);

  const updated = await prisma.$transaction(async (tx) => {
    const m = await updateMembershipStatus(membershipId, "ACTIVE", tx);

    await createNotification(
      {
        userId: membership.userId,
        type: "MEMBERSHIP_APPROVED",
        title: "Membership approved",
        message: `Your membership to ${membership.client.name} has been approved.`,
        metadata: { membershipId, clientId: membership.clientId },
      },
      tx,
    );

    return m;
  });

  logger.info("Membership approved", {
    membershipId,
    approvedBy: actingUserId,
  });

  return formatMembershipResponse(updated);
}

/**
 * Reject a pending membership.
 */
export async function rejectMembership(
  membershipId: number,
  actingUserId: number,
): Promise<MembershipDetailResponse> {
  const membership = await findMembershipById(membershipId);
  if (!membership) throw new Error("Membership not found");
  if (membership.status !== "PENDING") {
    throw new Error("Only PENDING memberships can be rejected");
  }

  await assertCallerIsAdmin(actingUserId, membership.clientId);

  const updated = await prisma.$transaction(async (tx) => {
    const m = await updateMembershipStatus(membershipId, "REJECTED", tx);

    await createNotification(
      {
        userId: membership.userId,
        type: "MEMBERSHIP_REJECTED",
        title: "Membership request declined",
        message: `Your request to join ${membership.client.name} has been declined.`,
        metadata: { membershipId, clientId: membership.clientId },
      },
      tx,
    );

    return m;
  });

  logger.info("Membership rejected", {
    membershipId,
    rejectedBy: actingUserId,
  });

  return formatMembershipResponse(updated);
}

/**
 * Change the role of an existing membership.
 */
export async function changeMembershipRole(
  membershipId: number,
  newRole: UserRole,
  actingUserId: number,
): Promise<MembershipDetailResponse> {
  const membership = await findMembershipById(membershipId);
  if (!membership) throw new Error("Membership not found");

  await assertCallerIsAdmin(actingUserId, membership.clientId);

  // Prevent demoting the last admin
  if (membership.role === "ADMIN" || membership.role === "OWNER") {
    if (newRole !== "ADMIN" && newRole !== "OWNER") {
      const admins = await findMembershipsByClient(membership.clientId, "ACTIVE");
      const adminCount = admins.filter(
        (m) => (m.role === "ADMIN" || m.role === "OWNER") && m.id !== membershipId,
      ).length;
      if (adminCount === 0) {
        throw new Error("Cannot demote the last admin of this organization");
      }
    }
  }

  const updated = await updateMembershipRole(membershipId, newRole);

  logger.info("Membership role changed", {
    membershipId,
    newRole,
    changedBy: actingUserId,
  });

  return formatMembershipResponse(updated);
}

/**
 * Remove a membership entirely.
 */
export async function removeMembership(
  membershipId: number,
  actingUserId: number,
): Promise<void> {
  const membership = await findMembershipById(membershipId);
  if (!membership) throw new Error("Membership not found");

  // Users can remove their own membership; admins can remove others
  if (membership.userId !== actingUserId) {
    await assertCallerIsAdmin(actingUserId, membership.clientId);
  }

  await deleteMembership(membershipId);

  logger.info("Membership removed", {
    membershipId,
    removedBy: actingUserId,
  });
}

/**
 * List members of a client (for admin dashboard).
 */
export async function listClientMembers(
  clientId: number,
  status?: MembershipStatus,
): Promise<MembershipDetailResponse[]> {
  const memberships = await findMembershipsByClient(clientId, status);
  return memberships.map(formatMembershipResponse);
}

/**
 * List a user's own memberships.
 */
export async function listUserMemberships(
  userId: number,
): Promise<MembershipDetailResponse[]> {
  const memberships = await findMembershipsByUser(userId);
  return memberships.map(formatMembershipResponse);
}

// ── Helpers ──────────────────────────────────────────────────

async function assertCallerIsAdmin(
  userId: number,
  clientId: number,
): Promise<void> {
  const callerMembership = await findMembershipByUserAndClient(userId, clientId);
  if (!callerMembership) {
    throw new Error("Not a member of this organization");
  }
  if (callerMembership.status !== "ACTIVE") {
    throw new Error("Your membership is not active");
  }
  if (callerMembership.role !== "ADMIN" && callerMembership.role !== "OWNER") {
    throw new Error("Only admins can perform this action");
  }
}

function formatMembershipResponse(
  m: NonNullable<Awaited<ReturnType<typeof findMembershipById>>>,
): MembershipDetailResponse {
  return {
    id: m.id,
    user_id: m.userId,
    client_id: m.clientId,
    role: m.role,
    status: m.status,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
    user: m.user
      ? {
          id: m.user.id,
          email: m.user.email,
          name: m.user.name,
          image_url: m.user.imageUrl,
        }
      : undefined,
    client: m.client
      ? {
          id: m.client.id,
          name: m.client.name,
          slug: m.client.slug,
          domain: m.client.domain,
          logo: m.client.logo,
          plan: m.client.plan,
          active: m.client.active,
        }
      : undefined,
  };
}
