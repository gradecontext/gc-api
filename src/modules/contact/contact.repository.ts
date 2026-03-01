/**
 * Contact Messages Repository
 * Data access layer for contact message operations
 */

import { prisma } from "../../db/client";
import { ContactMessageStatus, ContactPriority } from "@prisma/client";
import { logger } from "../../utils/logger";

const contactSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  subject: true,
  message: true,
  source: true,
  status: true,
  priority: true,
  contactedBy: true,
  respondedAt: true,
  ipAddress: true,
  createdAt: true,
  updatedAt: true,
} as const;

const contactWithAdminSelect = {
  ...contactSelect,
  contactedByAdmin: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
} as const;

export interface ContactCreateData {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  source?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ContactUpdateData {
  status?: ContactMessageStatus;
  priority?: ContactPriority;
  contactedBy?: number | null;
  respondedAt?: Date | null;
}

export async function createContactMessage(data: ContactCreateData) {
  logger.debug("Creating contact message", { email: data.email });

  return await prisma.contactMessage.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      subject: data.subject,
      message: data.message,
      source: data.source ?? null,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
    },
    select: contactWithAdminSelect,
  });
}

export async function findContactById(id: number) {
  return await prisma.contactMessage.findUnique({
    where: { id },
    select: contactWithAdminSelect,
  });
}

export async function findContacts(filters: {
  status?: ContactMessageStatus;
  priority?: ContactPriority;
  contactedBy?: number;
  skip?: number;
  take?: number;
}) {
  const where: {
    status?: ContactMessageStatus;
    priority?: ContactPriority;
    contactedBy?: number;
  } = {};

  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.contactedBy) where.contactedBy = filters.contactedBy;

  const [messages, total] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      select: contactWithAdminSelect,
      orderBy: { createdAt: "desc" },
      skip: filters.skip,
      take: filters.take,
    }),
    prisma.contactMessage.count({ where }),
  ]);

  return { messages, total };
}

export async function updateContactMessage(id: number, data: ContactUpdateData) {
  logger.debug("Updating contact message", { id });

  return await prisma.contactMessage.update({
    where: { id },
    data: {
      status: data.status,
      priority: data.priority,
      contactedBy: data.contactedBy,
      respondedAt: data.respondedAt,
    },
    select: contactWithAdminSelect,
  });
}
