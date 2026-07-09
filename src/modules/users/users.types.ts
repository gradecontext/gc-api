/**
 * User module types
 * Central type definitions for the users domain
 */

import { Gender, UserRole, MembershipStatus, PlanTier } from '@prisma/client';
import { ClientInputForUser } from '../clients/clients.types';

export type { Gender, UserRole, MembershipStatus };

/**
 * Non-sensitive client fields safe to return on user-facing profile
 * endpoints. Deliberately excludes api_key / webhook_secret.
 */
export interface ClientSummary {
  id: number;
  name: string;
  slug: string;
  domain: string | null;
  logo: string | null;
  cover_image: string | null;
  details: string | null;
  client_website: string | null;
  client_x: string | null;
  client_linkedin: string | null;
  client_instagram: string | null;
  verified: boolean;
  plan: PlanTier;
  active: boolean;
}

/**
 * POST /users request body.
 * The `client` object must contain either `client_id` (to join an existing
 * client) or `client_name` (to find-or-create a client).
 */
export interface CreateUserInput {
  client: ClientInputForUser;
  email: string;
  name?: string;
  title?: string;
  display_name?: string;
  user_name?: string;
  image_url?: string;
  user_image?: string;
  user_image_cover?: string;
  user_bio_detail?: string;
  user_bio_brief?: string;
  gender?: Gender;
}

export interface UpdateUserInput {
  name?: string;
  title?: string;
  display_name?: string;
  user_name?: string;
  image_url?: string;
  user_image?: string;
  user_image_cover?: string;
  user_bio_detail?: string;
  user_bio_brief?: string;
  gender?: Gender | null;
}

export interface MembershipResponse {
  id: number;
  client_id: number;
  role: UserRole;
  status: MembershipStatus;
  created_at: Date;
  updated_at: Date;
  client?: ClientSummary;
}

export interface UserResponse {
  id: number;
  supabase_auth_id: string | null;
  email: string;
  name: string | null;
  title: string | null;
  active: boolean;
  verified: boolean;
  display_name: string | null;
  user_name: string | null;
  image_url: string | null;
  user_image: string | null;
  user_image_cover: string | null;
  user_bio_detail: string | null;
  user_bio_brief: string | null;
  gender: Gender | null;
  created_at: Date;
  updated_at: Date;
  memberships: MembershipResponse[];
  /** The user's currently resolved company (see resolveCurrentClient in users.service.ts). */
  client?: ClientSummary;
}
