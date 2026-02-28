/**
 * Notifications Repository
 * Data access layer for in-app notifications
 */

import { prisma } from "../../db/client";
import { NotificationType, Prisma } from "@prisma/client";
import { logger } from "../../utils/logger";

export interface NotificationCreateData {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export const notificationSelect = {
  id: true,
  userId: true,
  type: true,
  title: true,
  message: true,
  metadata: true,
  read: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Create a single notification
 */
export async function createNotification(
  data: NotificationCreateData,
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;

  logger.debug("Creating notification", {
    userId: data.userId,
    type: data.type,
  });

  return await db.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
    },
    select: notificationSelect,
  });
}

/**
 * Create notifications in bulk (e.g. notify all admins of a client)
 */
export async function createManyNotifications(
  items: NotificationCreateData[],
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;

  logger.debug("Creating bulk notifications", { count: items.length });

  // createMany doesn't support select, so we use a loop inside the transaction
  const results = [];
  for (const data of items) {
    const n = await db.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
      },
      select: notificationSelect,
    });
    results.push(n);
  }
  return results;
}

/**
 * List notifications for a user (newest first, paginated)
 */
export async function findNotificationsByUser(
  userId: number,
  opts?: { unreadOnly?: boolean; limit?: number; offset?: number },
) {
  return await prisma.notification.findMany({
    where: {
      userId,
      ...(opts?.unreadOnly ? { read: false } : {}),
    },
    select: notificationSelect,
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 50,
    skip: opts?.offset ?? 0,
  });
}

/**
 * Count unread notifications for a user
 */
export async function countUnreadNotifications(userId: number) {
  return await prisma.notification.count({
    where: { userId, read: false },
  });
}

/**
 * Mark a single notification as read
 */
export async function markNotificationRead(id: number, userId: number) {
  return await prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(userId: number) {
  return await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}
