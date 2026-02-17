/**
 * Clients Repository
 * Data access layer for client operations
 *
 * All query methods accept an optional Prisma transaction client
 * so they can participate in cross-module transactions (e.g. user+client creation).
 */

import { prisma } from '../../db/client';
import { ClientPlan, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';

export interface ClientCreateData {
  name: string;
  slug: string;
  domain?: string;
  apiKey: string;
  webhookSecret: string;
  plan: ClientPlan;
  details?: string;
  logo?: string;
  coverImage?: string;
  clientWebsite?: string;
  clientX?: string;
  clientLinkedin?: string;
  clientInstagram?: string;
  settings?: Record<string, unknown>;
}

export const clientSelect = {
  id: true,
  name: true,
  slug: true,
  domain: true,
  apiKey: true,
  webhookSecret: true,
  plan: true,
  active: true,
  verified: true,
  approved: true,
  details: true,
  logo: true,
  coverImage: true,
  clientWebsite: true,
  clientX: true,
  clientLinkedin: true,
  clientInstagram: true,
  settings: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Create a new client record
 */
export async function createClientRecord(
  data: ClientCreateData,
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;

  logger.debug('Creating client', { name: data.name, slug: data.slug });

  return await db.client.create({
    data: {
      name: data.name,
      slug: data.slug,
      domain: data.domain ?? null,
      apiKey: data.apiKey,
      webhookSecret: data.webhookSecret,
      plan: data.plan,
      details: data.details ?? null,
      logo: data.logo ?? null,
      coverImage: data.coverImage ?? null,
      clientWebsite: data.clientWebsite ?? null,
      clientX: data.clientX ?? null,
      clientLinkedin: data.clientLinkedin ?? null,
      clientInstagram: data.clientInstagram ?? null,
      settings: (data.settings ?? {}) as Prisma.InputJsonValue,
    },
    select: clientSelect,
  });
}

/**
 * Find client by primary key
 */
export async function findClientById(
  id: number,
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;
  return await db.client.findUnique({
    where: { id },
    select: clientSelect,
  });
}

/**
 * Find client by domain (e.g. "emergent.com")
 */
export async function findClientByDomain(
  domain: string,
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;
  return await db.client.findFirst({
    where: { domain },
    select: clientSelect,
  });
}

/**
 * Find client by unique slug
 */
export async function findClientBySlug(
  slug: string,
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;
  return await db.client.findUnique({
    where: { slug },
    select: clientSelect,
  });
}
