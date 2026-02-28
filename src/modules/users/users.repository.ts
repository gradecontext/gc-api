/**
 * Users Repository
 * Data access layer for user operations
 *
 * All mutation/query methods accept an optional Prisma transaction client
 * so they can participate in cross-module transactions (e.g. atomic user+membership creation).
 */

import { prisma } from '../../db/client';
import { Gender, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';

export interface UserCreateData {
  supabaseAuthId: string;
  email: string;
  name?: string;
  title?: string;
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
  email: true,
  name: true,
  title: true,
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

const userWithMembershipsSelect = {
  ...userSelect,
  memberships: {
    select: {
      id: true,
      clientId: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
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
    },
    orderBy: { createdAt: 'desc' as const },
  },
} as const;

/**
 * Create a new user (identity only — no client attachment).
 * Membership is created separately.
 */
export async function createUser(
  data: UserCreateData,
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;

  logger.debug('Creating user', {
    supabaseAuthId: data.supabaseAuthId,
    email: data.email,
  });

  return await db.user.create({
    data: {
      supabaseAuthId: data.supabaseAuthId,
      email: data.email,
      name: data.name ?? null,
      title: data.title ?? null,
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
    select: userWithMembershipsSelect,
  });
}

/**
 * Find user by Supabase auth ID (includes memberships)
 */
export async function findUserBySupabaseId(
  supabaseAuthId: string,
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;
  return await db.user.findUnique({
    where: { supabaseAuthId },
    select: userWithMembershipsSelect,
  });
}

/**
 * Find user by email (globally unique)
 */
export async function findUserByEmail(
  email: string,
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;
  return await db.user.findUnique({
    where: { email },
    select: userWithMembershipsSelect,
  });
}

/**
 * Find user by internal ID
 */
export async function findUserById(id: number) {
  return await prisma.user.findUnique({
    where: { id },
    select: userWithMembershipsSelect,
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
    select: userWithMembershipsSelect,
  });
}

/**
 * Link an existing user to a Supabase auth account
 */
export async function linkSupabaseAuth(userId: number, supabaseAuthId: string) {
  return await prisma.user.update({
    where: { id: userId },
    data: { supabaseAuthId },
    select: userWithMembershipsSelect,
  });
}
