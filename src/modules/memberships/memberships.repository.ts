/**
 * Memberships Repository
 * Data access layer for the User ↔ Client join table
 */

import { prisma } from "../../db/client";
import { UserRole, MembershipStatus, Prisma } from "@prisma/client";
import { logger } from "../../utils/logger";

export interface MembershipCreateData {
  userId: number;
  clientId: number;
  role?: UserRole;
  status?: MembershipStatus;
}

export const membershipSelect = {
  id: true,
  userId: true,
  clientId: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      name: true,
      imageUrl: true,
    },
  },
  client: {
    select: {
      id: true,
      name: true,
      slug: true,
      domain: true,
      logo: true,
      plan: true,
      active: true,
    },
  },
} as const;

/**
 * Create a new membership
 */
export async function createMembership(
  data: MembershipCreateData,
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;

  logger.debug("Creating membership", {
    userId: data.userId,
    clientId: data.clientId,
    role: data.role,
    status: data.status,
  });

  return await db.membership.create({
    data: {
      userId: data.userId,
      clientId: data.clientId,
      role: data.role ?? "VIEWER",
      status: data.status ?? "PENDING",
    },
    select: membershipSelect,
  });
}

/**
 * Find a specific membership by user + client (compound unique)
 */
export async function findMembershipByUserAndClient(
  userId: number,
  clientId: number,
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;
  return await db.membership.findUnique({
    where: { userId_clientId: { userId, clientId } },
    select: membershipSelect,
  });
}

/**
 * Find membership by ID
 */
export async function findMembershipById(
  id: number,
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;
  return await db.membership.findUnique({
    where: { id },
    select: membershipSelect,
  });
}

/**
 * List all memberships for a client (optionally filtered by status)
 */
export async function findMembershipsByClient(
  clientId: number,
  status?: MembershipStatus,
) {
  return await prisma.membership.findMany({
    where: {
      clientId,
      ...(status ? { status } : {}),
    },
    select: membershipSelect,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * List all memberships for a user
 */
export async function findMembershipsByUser(userId: number) {
  return await prisma.membership.findMany({
    where: { userId },
    select: membershipSelect,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Find all ACTIVE admin/owner memberships for a client.
 * Used to determine who should receive notifications (e.g. membership requests).
 */
export async function findActiveAdminsForClient(
  clientId: number,
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;
  return await db.membership.findMany({
    where: {
      clientId,
      status: "ACTIVE",
      role: { in: ["OWNER", "ADMIN"] },
    },
    select: {
      id: true,
      userId: true,
      role: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });
}

/**
 * Update membership status (approve / reject)
 */
export async function updateMembershipStatus(
  id: number,
  status: MembershipStatus,
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;

  logger.debug("Updating membership status", { id, status });

  return await db.membership.update({
    where: { id },
    data: { status },
    select: membershipSelect,
  });
}

/**
 * Update membership role
 */
export async function updateMembershipRole(
  id: number,
  role: UserRole,
) {
  logger.debug("Updating membership role", { id, role });

  return await prisma.membership.update({
    where: { id },
    data: { role },
    select: membershipSelect,
  });
}

/**
 * Delete a membership
 */
export async function deleteMembership(id: number) {
  logger.debug("Deleting membership", { id });
  return await prisma.membership.delete({ where: { id } });
}

/**
 * Find a user's ACTIVE memberships (for auth middleware — quick lookup)
 */
export async function findActiveMembershipsForUser(
  userId: number,
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;
  return await db.membership.findMany({
    where: { userId, status: "ACTIVE" },
    select: {
      id: true,
      clientId: true,
      role: true,
    },
  });
}
