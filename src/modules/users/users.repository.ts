/**
 * Users Repository
 * Data access layer for user operations
 *
 * All mutation/query methods accept an optional Prisma transaction client
 * so they can participate in cross-module transactions (e.g. atomic user+client creation).
 */

import { prisma } from '../../db/client';
import { UserRole, Gender, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';

export interface UserCreateData {
  supabaseAuthId: string;
  clientId: number;
  email: string;
  name?: string;
  title?: string;
  role?: UserRole;
  displayName?: string;
  userName?: string;
  imageUrl?: string;
  userImage?: string;
  userImageCover?: string;
  userBioDetail?: string;
  userBioBrief?: string;
  gender?: Gender;
}

export interface UserUpdateData {
  name?: string;
  title?: string;
  displayName?: string;
  userName?: string;
  imageUrl?: string;
  userImage?: string;
  userImageCover?: string;
  userBioDetail?: string;
  userBioBrief?: string;
  gender?: Gender | null;
}

const userSelect = {
  id: true,
  supabaseAuthId: true,
  clientId: true,
  email: true,
  name: true,
  title: true,
  role: true,
  active: true,
  verified: true,
  displayName: true,
  userName: true,
  imageUrl: true,
  userImage: true,
  userImageCover: true,
  userBioDetail: true,
  userBioBrief: true,
  gender: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Create a new user linked to a Supabase auth account
 */
export async function createUser(
  data: UserCreateData,
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;

  logger.debug('Creating user', {
    supabaseAuthId: data.supabaseAuthId,
    clientId: data.clientId,
    email: data.email,
  });

  return await db.user.create({
    data: {
      supabaseAuthId: data.supabaseAuthId,
      clientId: data.clientId,
      email: data.email,
      name: data.name ?? null,
      title: data.title ?? null,
      role: data.role ?? 'VIEWER',
      verified: true,
      displayName: data.displayName ?? null,
      userName: data.userName ?? null,
      imageUrl: data.imageUrl ?? null,
      userImage: data.userImage ?? null,
      userImageCover: data.userImageCover ?? null,
      userBioDetail: data.userBioDetail ?? null,
      userBioBrief: data.userBioBrief ?? null,
      gender: data.gender ?? null,
    },
    select: userSelect,
  });
}

/**
 * Find user by Supabase auth ID
 */
export async function findUserBySupabaseId(
  supabaseAuthId: string,
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;
  return await db.user.findUnique({
    where: { supabaseAuthId },
    select: userSelect,
  });
}

/**
 * Find user by internal ID
 */
export async function findUserById(id: number) {
  return await prisma.user.findUnique({
    where: { id },
    select: userSelect,
  });
}

/**
 * Find user by client + email
 */
export async function findUserByClientEmail(
  clientId: number,
  email: string,
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;
  return await db.user.findUnique({
    where: {
      clientId_email: { clientId, email },
    },
    select: userSelect,
  });
}

/**
 * Update user profile
 */
export async function updateUser(id: number, data: UserUpdateData) {
  logger.debug('Updating user', { id });

  return await prisma.user.update({
    where: { id },
    data: {
      name: data.name,
      title: data.title,
      displayName: data.displayName,
      userName: data.userName,
      imageUrl: data.imageUrl,
      userImage: data.userImage,
      userImageCover: data.userImageCover,
      userBioDetail: data.userBioDetail,
      userBioBrief: data.userBioBrief,
      gender: data.gender,
    },
    select: userSelect,
  });
}

/**
 * Link an existing user to a Supabase auth account
 */
export async function linkSupabaseAuth(userId: number, supabaseAuthId: string) {
  return await prisma.user.update({
    where: { id: userId },
    data: { supabaseAuthId },
    select: userSelect,
  });
}
