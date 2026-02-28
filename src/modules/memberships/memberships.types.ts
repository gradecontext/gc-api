/**
 * Membership module types
 */

import { UserRole, MembershipStatus, ClientPlan } from "@prisma/client";

export type { UserRole, MembershipStatus };

export interface MembershipDetailResponse {
  id: number;
  user_id: number;
  client_id: number;
  role: UserRole;
  status: MembershipStatus;
  created_at: Date;
  updated_at: Date;
  user?: {
    id: number;
    email: string;
    name: string | null;
    image_url: string | null;
  };
  client?: {
    id: number;
    name: string;
    slug: string;
    domain: string | null;
    logo: string | null;
    plan: ClientPlan;
    active: boolean;
  };
}
