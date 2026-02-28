/**
 * Notification module types
 */

import { NotificationType } from "@prisma/client";

export type { NotificationType };

export interface NotificationResponse {
  id: number;
  user_id: number;
  type: NotificationType;
  title: string;
  message: string;
  metadata: unknown;
  read: boolean;
  created_at: Date;
  updated_at: Date;
}
