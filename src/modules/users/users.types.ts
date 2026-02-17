/**
 * User module types
 * Central type definitions for the users domain
 */

import { UserRole, Gender } from '@prisma/client';
import { ClientInputForUser, ClientResponse } from '../clients/clients.types';

export type { UserRole, Gender };

/**
 * POST /users request body.
 * The `client` object must contain either `client_id` (to attach to an existing
 * client) or `client_name` (to find-or-create a client).
 */
export interface CreateUserInput {
  client: ClientInputForUser;
  email: string;
  name?: string;
  title?: string;
  role?: UserRole;
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

export interface UserResponse {
  id: number;
  supabase_auth_id: string | null;
  client_id: number;
  email: string;
  name: string | null;
  title: string | null;
  role: UserRole;
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
  client?: ClientResponse;
}
