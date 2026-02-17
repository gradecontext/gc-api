/**
 * Leads Repository
 * Data access layer for lead operations
 */

import { prisma } from '../../db/client';
import { LeadStatus, ClientPlan } from '@prisma/client';
import { logger } from '../../utils/logger';

const leadSelect = {
  id: true,
  email: true,
  fullName: true,
  companyName: true,
  companySize: true,
  companyWebsite: true,
  planInterest: true,
  message: true,
  contacted: true,
  status: true,
  convertedToUserId: true,
  convertedToClientId: true,
  representedBy: true,
  createdAt: true,
  updatedAt: true,
} as const;

const leadWithAdminSelect = {
  ...leadSelect,
  representedByAdmin: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
} as const;

export interface LeadCreateData {
  email: string;
  fullName?: string;
  companyName?: string;
  companySize?: string;
  companyWebsite?: string;
  planInterest?: ClientPlan;
  message?: string;
}

export interface LeadUpdateData {
  fullName?: string;
  companyName?: string;
  companySize?: string;
  companyWebsite?: string;
  planInterest?: ClientPlan | null;
  message?: string;
  contacted?: boolean;
  status?: LeadStatus;
  representedBy?: number | null;
  convertedToUserId?: number | null;
  convertedToClientId?: number | null;
}

export async function createLead(data: LeadCreateData) {
  logger.debug('Creating lead', { email: data.email });

  return await prisma.lead.create({
    data: {
      email: data.email,
      fullName: data.fullName ?? null,
      companyName: data.companyName ?? null,
      companySize: data.companySize ?? null,
      companyWebsite: data.companyWebsite ?? null,
      planInterest: data.planInterest ?? null,
      message: data.message ?? null,
    },
    select: leadWithAdminSelect,
  });
}

export async function findLeadById(id: number) {
  return await prisma.lead.findUnique({
    where: { id },
    select: leadWithAdminSelect,
  });
}

export async function findLeadsByEmail(email: string) {
  return await prisma.lead.findMany({
    where: { email },
    select: leadWithAdminSelect,
    orderBy: { createdAt: 'desc' },
  });
}

export async function findLeads(filters: {
  status?: LeadStatus;
  contacted?: boolean;
  representedBy?: number;
  skip?: number;
  take?: number;
}) {
  const where: {
    status?: LeadStatus;
    contacted?: boolean;
    representedBy?: number;
  } = {};

  if (filters.status) where.status = filters.status;
  if (filters.contacted !== undefined) where.contacted = filters.contacted;
  if (filters.representedBy) where.representedBy = filters.representedBy;

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      select: leadWithAdminSelect,
      orderBy: { createdAt: 'desc' },
      skip: filters.skip,
      take: filters.take,
    }),
    prisma.lead.count({ where }),
  ]);

  return { leads, total };
}

export async function updateLead(id: number, data: LeadUpdateData) {
  logger.debug('Updating lead', { id });

  return await prisma.lead.update({
    where: { id },
    data: {
      fullName: data.fullName,
      companyName: data.companyName,
      companySize: data.companySize,
      companyWebsite: data.companyWebsite,
      planInterest: data.planInterest,
      message: data.message,
      contacted: data.contacted,
      status: data.status,
      representedBy: data.representedBy,
      convertedToUserId: data.convertedToUserId,
      convertedToClientId: data.convertedToClientId,
    },
    select: leadWithAdminSelect,
  });
}
