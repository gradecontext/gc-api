/**
 * Notifications Controller
 * Request/response handling for notification endpoints
 */

import { Context } from "hono";
import { logger } from "../../utils/logger";
import { getUserNotifications, markRead, markAllRead } from "./notifications.service";

/**
 * GET /notifications
 */
export async function listNotificationsHandler(c: Context) {
  try {
    const userId = c.get("userId") as number | undefined;
    if (!userId) {
      return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
    }

    const unreadOnly = c.req.query("unread") === "true";
    const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10) || 50, 100);
    const offset = parseInt(c.req.query("offset") ?? "0", 10) || 0;

    const result = await getUserNotifications(userId, { unreadOnly, limit, offset });

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    logger.error(
      "Error listing notifications",
      error instanceof Error ? error : new Error(String(error)),
    );
    throw error;
  }
}

/**
 * PATCH /notifications/:id/read
 */
export async function markReadHandler(c: Context) {
  try {
    const userId = c.get("userId") as number | undefined;
    if (!userId) {
      return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
    }

    const notificationId = parseInt(c.req.param("id"), 10);
    if (isNaN(notificationId)) {
      return c.json({ error: "Bad Request", message: "Invalid notification ID" }, 400);
    }

    await markRead(notificationId, userId);
    return c.json({ success: true, message: "Notification marked as read" }, 200);
  } catch (error) {
    logger.error(
      "Error marking notification read",
      error instanceof Error ? error : new Error(String(error)),
    );
    throw error;
  }
}

/**
 * PATCH /notifications/read-all
 */
export async function markAllReadHandler(c: Context) {
  try {
    const userId = c.get("userId") as number | undefined;
    if (!userId) {
      return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
    }

    await markAllRead(userId);
    return c.json({ success: true, message: "All notifications marked as read" }, 200);
  } catch (error) {
    logger.error(
      "Error marking all notifications read",
      error instanceof Error ? error : new Error(String(error)),
    );
    throw error;
  }
}
