/**
 * Notifications Routes
 * Hono route definitions for notification endpoints
 *
 * All routes require authentication.
 */

import { Hono } from "hono";
import {
  listNotificationsHandler,
  markReadHandler,
  markAllReadHandler,
} from "./notifications.controller";
import { authenticate } from "../../middleware/auth.middleware";

const notifications = new Hono();

notifications.get("/notifications", authenticate, listNotificationsHandler);
notifications.patch(
  "/notifications/read-all",
  authenticate,
  markAllReadHandler,
);
notifications.patch("/notifications/:id/read", authenticate, markReadHandler);
notifications.patch("/notifications/:id/read", authenticate, markReadHandler);

export { notifications as notificationsRoutes };
