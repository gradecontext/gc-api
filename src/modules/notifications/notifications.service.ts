/**
 * Notifications Service
 * Business logic for in-app notification delivery and retrieval
 */

import { Prisma } from "@prisma/client";
import { logger } from "../../utils/logger";
import {
  createManyNotifications,
  findNotificationsByUser,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  NotificationCreateData,
} from "./notifications.repository";
import { findActiveAdminsForClient } from "../memberships/memberships.repository";
import { NotificationResponse } from "./notifications.types";

/**
 * Notify all ACTIVE admins/owners of a client about an event
 * (e.g. a new membership request).
 *
 * @param excludeUserId - Don't notify the user who triggered the event
 */
export async function notifyClientAdmins(
  clientId: number,
  excludeUserId: number,
  notification: Omit<NotificationCreateData, "userId">,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const admins = await findActiveAdminsForClient(clientId, tx);
  const recipients = admins.filter((a) => a.userId !== excludeUserId);

  if (recipients.length === 0) {
    logger.warn("No admins to notify for client", { clientId });
    return;
  }

  const items: NotificationCreateData[] = recipients.map((admin) => ({
    userId: admin.userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    metadata: notification.metadata,
  }));

  await createManyNotifications(items, tx);

  logger.info("Notified client admins", {
    clientId,
    recipientCount: recipients.length,
    type: notification.type,
  });
}

/**
 * Get a user's notifications (with optional unread filter)
 */
export async function getUserNotifications(
  userId: number,
  opts?: { unreadOnly?: boolean; limit?: number; offset?: number },
): Promise<{ notifications: NotificationResponse[]; unread_count: number }> {
  const [notifications, unreadCount] = await Promise.all([
    findNotificationsByUser(userId, opts),
    countUnreadNotifications(userId),
  ]);

  return {
    notifications: notifications.map(formatNotification),
    unread_count: unreadCount,
  };
}

/**
 * Mark a notification as read
 */
export async function markRead(
  notificationId: number,
  userId: number,
): Promise<void> {
  await markNotificationRead(notificationId, userId);
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllRead(userId: number): Promise<void> {
  await markAllNotificationsRead(userId);
}

// ── Helpers ──

function formatNotification(
  n: Awaited<ReturnType<typeof findNotificationsByUser>>[number],
): NotificationResponse {
  return {
    id: n.id,
    user_id: n.userId,
    type: n.type,
    title: n.title,
    message: n.message,
    metadata: n.metadata,
    read: n.read,
    created_at: n.createdAt,
    updated_at: n.updatedAt,
  };
}
