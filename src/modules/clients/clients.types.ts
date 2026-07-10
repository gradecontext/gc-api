/**
 * Client module types
 * Central type definitions for the clients domain
 */

import { PlanTier } from '@prisma/client';

export type { PlanTier };

/**
 * Input for creating a client (used both in standalone client creation
 * and embedded within user creation).
 */
export interface CreateClientInput {
  client_name: string;
  details?: string;
  logo?: string;
  cover_image?: string;
  client_website?: string;
  client_x?: string;
  client_linkedin?: string;
  client_instagram?: string;
  settings?: Record<string, unknown>;
}

/**
 * Client object nested inside the POST /users payload.
 * Either client_id or client_name must be present.
 */
export interface ClientInputForUser {
  client_id?: number;
  client_name?: string;
  /**
   * Explicit domain for a new client (e.g. front-end prefills this from the
   * creator's own email and asks for confirmation). Falls back to the
   * creator's email domain when omitted — see createVerifiedUser.
   */
  domain?: string;
  details?: string;
  logo?: string;
  cover_image?: string;
  client_website?: string;
  client_x?: string;
  client_linkedin?: string;
  client_instagram?: string;
  settings?: Record<string, unknown>;
}

export interface ClientResponse {
  id: number;
  name: string;
  slug: string;
  domain: string | null;
  api_key: string | null;
  mcp_api_key: string | null;
  webhook_secret: string | null;
  plan: PlanTier;
  active: boolean;
  verified: boolean;
  approved: boolean;
  details: string | null;
  logo: string | null;
  cover_image: string | null;
  client_website: string | null;
  client_x: string | null;
  client_linkedin: string | null;
  client_instagram: string | null;
  settings: unknown;
  added_by: number | null;
  modified_by: number | null;
  created_at: Date;
  updated_at: Date;
}
