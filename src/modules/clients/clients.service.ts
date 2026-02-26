/**
 * Clients Service
 * Business logic for client creation and management
 *
 * The clientCreate() method is reusable — called from user creation
 * and can also serve a standalone POST /clients endpoint.
 */

import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';
import {
  createClientRecord,
  findClientBySlug,
  ClientCreateData,
} from './clients.repository';
import { CreateClientInput, ClientResponse } from './clients.types';

/**
 * Generate an alphanumeric random key (upper + lower + digits only).
 */
export function generateRandomKey(length: number = 12): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Create a URL-friendly slug from a human name.
 * "Emergent Inc" → "emergent-inc"
 */
export function generateSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // strip non-alphanumeric except spaces and hyphens
    .replace(/[\s]+/g, '-') // spaces → hyphens
    .replace(/-+/g, '-') // collapse consecutive hyphens
    .replace(/^-|-$/g, ''); // trim leading/trailing hyphens
}

/**
 * Extract the domain (TLD portion) from an email address.
 * "adam@emergent.com" → "emergent.com"
 */
export function extractDomainFromEmail(email: string): string {
  const parts = email.split('@');
  return parts[parts.length - 1].toLowerCase();
}

/**
 * Public / shared email providers whose domains should never be used
 * for client-matching. Users with these domains are allowed to sign up
 * but won't be auto-grouped into the same client by domain.
 */
const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'google.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.co.in',
  'ymail.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'protonmail.com',
  'proton.me',
  'zoho.com',
  'zohomail.com',
  'mail.com',
  'gmx.com',
  'gmx.net',
  'fastmail.com',
  'tutanota.com',
  'tuta.io',
  'hey.com',
  'pm.me',
  'yandex.com',
  'yandex.ru',
  'qq.com',
  '163.com',
  '126.com',
  'rediffmail.com',
]);

/**
 * Returns true when the domain belongs to a public/shared email provider.
 * These domains must not be used for client-level domain matching.
 */
export function isPublicEmailDomain(domain: string): boolean {
  return PUBLIC_EMAIL_DOMAINS.has(domain.toLowerCase());
}

/**
 * Create a new client.
 *
 * - Generates a slug from the name (appends random suffix on collision)
 * - Generates 12-char alphanumeric webhook_secret and api_key
 * - Defaults plan to STARTER when not specified
 *
 * Accepts an optional Prisma transaction client for atomicity.
 */
export async function clientCreate(
  input: CreateClientInput,
  domain?: string,
  tx?: Prisma.TransactionClient
): Promise<ClientResponse> {
  const slug = generateSlug(input.client_name);

  // Ensure slug uniqueness — append random suffix on collision
  const existingBySlug = await findClientBySlug(slug, tx);
  const finalSlug = existingBySlug
    ? `${slug}-${generateRandomKey(4).toLowerCase()}`
    : slug;

  const webhookSecret = generateRandomKey(12);
  const apiKey = generateRandomKey(12);
  const plan = input.plan ?? 'STARTER';

  const data: ClientCreateData = {
    name: input.client_name,
    slug: finalSlug,
    domain: domain ?? undefined,
    apiKey,
    webhookSecret,
    plan,
    details: input.details,
    logo: input.logo,
    coverImage: input.cover_image,
    clientWebsite: input.client_website,
    clientX: input.client_x,
    clientLinkedin: input.client_linkedin,
    clientInstagram: input.client_instagram,
    settings: input.settings,
  };

  const client = await createClientRecord(data, tx);

  logger.info('Client created successfully', {
    clientId: client.id,
    slug: client.slug,
    plan: client.plan,
  });

  return formatClientResponse(client);
}

/**
 * Format a database client record to the API response shape.
 */
export function formatClientResponse(
  client: NonNullable<Awaited<ReturnType<typeof createClientRecord>>>
): ClientResponse {
  return {
    id: client.id,
    name: client.name,
    slug: client.slug,
    domain: client.domain,
    api_key: client.apiKey,
    webhook_secret: client.webhookSecret,
    plan: client.plan,
    active: client.active,
    verified: client.verified,
    approved: client.approved,
    details: client.details,
    logo: client.logo,
    cover_image: client.coverImage,
    client_website: client.clientWebsite,
    client_x: client.clientX,
    client_linkedin: client.clientLinkedin,
    client_instagram: client.clientInstagram,
    settings: client.settings,
    added_by: client.addedBy,
    modified_by: client.modifiedBy,
    created_at: client.createdAt,
    updated_at: client.updatedAt,
  };
}
