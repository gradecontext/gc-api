/**
 * Client module types
 * Central type definitions for the clients domain
 */

import { ClientPlan } from '@prisma/client';

export type { ClientPlan };

/**
 * Input for creating a client (used both in standalone client creation
 * and embedded within user creation).
 */
export interface CreateClientInput {
  client_name: string;
  plan?: ClientPlan;
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
  plan?: ClientPlan;
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
  webhook_secret: string | null;
  plan: ClientPlan;
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
  created_at: Date;
  updated_at: Date;
}
