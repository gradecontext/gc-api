/**
 * Admin module types
 */

import { AccessLevel } from '@prisma/client';

export type { AccessLevel };

export interface CreateAdminInput {
  full_name: string;
  email: string;
  access_level?: AccessLevel;
}

export interface UpdateAdminInput {
  full_name?: string;
  email?: string;
  access_level?: AccessLevel;
  active?: boolean;
}

export interface AdminResponse {
  id: number;
  full_name: string;
  email: string;
  active: boolean;
  access_level: AccessLevel;
  created_at: Date;
  updated_at: Date;
}
