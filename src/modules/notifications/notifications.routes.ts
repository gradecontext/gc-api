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

notifications.use("*", authenticate);

notifications.get("/notifications", listNotificationsHandler);
notifications.patch("/notifications/read-all", markAllReadHandler);
notifications.patch("/notifications/:id/read", markReadHandler);

export { notifications as notificationsRoutes };
