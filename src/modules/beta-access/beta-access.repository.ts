/**
 * Beta Access List Repository
 * Data access layer for beta access list operations
 */

import { prisma } from "../../db/client";
import { ClientPlan } from "@prisma/client";
import { logger } from "../../utils/logger";

const betaAccessSelect = {
  id: true,
  fullName: true,
  email: true,
  companyName: true,
  numberOfUsersRange: true,
  source: true,
  planInterest: true,
  allowAccess: true,
  approvedBy: true,
  approvedAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

const betaAccessWithAdminSelect = {
  ...betaAccessSelect,
  approvedByAdmin: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
} as const;

export interface BetaAccessCreateData {
  fullName: string;
  email: string;
  companyName?: string;
  numberOfUsersRange?: string;
  source?: string;
  planInterest?: ClientPlan;
  notes?: string;
}

export interface BetaAccessUpdateData {
  fullName?: string;
  companyName?: string;
  numberOfUsersRange?: string;
  source?: string;
  planInterest?: ClientPlan | null;
  allowAccess?: boolean;
  approvedBy?: number | null;
  approvedAt?: Date | null;
  notes?: string;
}

export async function createBetaAccess(data: BetaAccessCreateData) {
  logger.debug("Creating beta access entry", { email: data.email });

  return await prisma.betaAccessList.create({
    data: {
      fullName: data.fullName,
      email: data.email,
      companyName: data.companyName ?? null,
      numberOfUsersRange: data.numberOfUsersRange ?? null,
      source: data.source ?? null,
      planInterest: data.planInterest ?? null,
      notes: data.notes ?? null,
    },
    select: betaAccessWithAdminSelect,
  });
}

export async function findBetaAccessById(id: number) {
  return await prisma.betaAccessList.findUnique({
    where: { id },
    select: betaAccessWithAdminSelect,
  });
}

export async function findBetaAccessByEmail(email: string) {
  return await prisma.betaAccessList.findUnique({
    where: { email },
    select: betaAccessWithAdminSelect,
  });
}

export async function findBetaAccessEntries(filters: {
  allowAccess?: boolean;
  planInterest?: ClientPlan;
  skip?: number;
  take?: number;
}) {
  const where: {
    allowAccess?: boolean;
    planInterest?: ClientPlan;
  } = {};

  if (filters.allowAccess !== undefined) where.allowAccess = filters.allowAccess;
  if (filters.planInterest) where.planInterest = filters.planInterest;

  const [entries, total] = await Promise.all([
    prisma.betaAccessList.findMany({
      where,
      select: betaAccessWithAdminSelect,
      orderBy: { createdAt: "desc" },
      skip: filters.skip,
      take: filters.take,
    }),
    prisma.betaAccessList.count({ where }),
  ]);

  return { entries, total };
}

export async function updateBetaAccess(id: number, data: BetaAccessUpdateData) {
  logger.debug("Updating beta access entry", { id });

  return await prisma.betaAccessList.update({
    where: { id },
    data: {
      fullName: data.fullName,
      companyName: data.companyName,
      numberOfUsersRange: data.numberOfUsersRange,
      source: data.source,
      planInterest: data.planInterest,
      allowAccess: data.allowAccess,
      approvedBy: data.approvedBy,
      approvedAt: data.approvedAt,
      notes: data.notes,
    },
    select: betaAccessWithAdminSelect,
  });
}
