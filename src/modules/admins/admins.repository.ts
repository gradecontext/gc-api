/**
 * Admins Repository
 * Data access layer for admin operations
 */

import { prisma } from '../../db/client';
import { AccessLevel } from '@prisma/client';
import { logger } from '../../utils/logger';

const adminSelect = {
  id: true,
  fullName: true,
  email: true,
  active: true,
  accessLevel: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function createAdmin(data: {
  fullName: string;
  email: string;
  accessLevel?: AccessLevel;
}) {
  logger.debug('Creating admin', { email: data.email });

  return await prisma.admin.create({
    data: {
      fullName: data.fullName,
      email: data.email,
      accessLevel: data.accessLevel ?? 'STAFF',
    },
    select: adminSelect,
  });
}

export async function findAdminById(id: number) {
  return await prisma.admin.findUnique({
    where: { id },
    select: adminSelect,
  });
}

export async function findAdminByEmail(email: string) {
  return await prisma.admin.findUnique({
    where: { email },
    select: adminSelect,
  });
}

export async function findAllAdmins(activeOnly: boolean = false) {
  return await prisma.admin.findMany({
    where: activeOnly ? { active: true } : undefined,
    select: adminSelect,
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateAdmin(
  id: number,
  data: {
    fullName?: string;
    email?: string;
    accessLevel?: AccessLevel;
    active?: boolean;
  }
) {
  logger.debug('Updating admin', { id });

  return await prisma.admin.update({
    where: { id },
    data: {
      fullName: data.fullName,
      email: data.email,
      accessLevel: data.accessLevel,
      active: data.active,
    },
    select: adminSelect,
  });
}

export async function deactivateAdmin(id: number) {
  return await prisma.admin.update({
    where: { id },
    data: { active: false },
    select: adminSelect,
  });
}
