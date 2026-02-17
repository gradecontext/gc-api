/**
 * Users Service
 * Business logic for user creation and management
 *
 * Handles:
 * - Supabase-verified user creation (ensures the Supabase user exists)
 * - Atomic user + client creation in a single transaction
 * - Profile management
 * - User lookup
 */

import { logger } from '../../utils/logger';
import { supabaseAdmin } from '../../lib/supabase';
import { prisma } from '../../db/client';
import {
  createUser,
  findUserBySupabaseId,
  findUserByClientEmail,
  findUserById,
  updateUser,
  UserCreateData,
  UserUpdateData,
} from './users.repository';
import {
  CreateUserInput,
  UpdateUserInput,
  UserResponse,
} from './users.types';
import {
  findClientById,
  findClientByDomain,
} from '../clients/clients.repository';
import {
  clientCreate,
  extractDomainFromEmail,
  formatClientResponse,
} from '../clients/clients.service';
import { ClientResponse } from '../clients/clients.types';

/**
 * Create a user after verifying their Supabase auth identity.
 *
 * Flow:
 * 1. Verify the Supabase user exists and retrieve their trusted email
 * 2. Validate email consistency with the request
 * 3. Resolve or create the client (atomic transaction):
 *    a. If client_id is provided → verify it exists and is active
 *    b. If client_name is provided → extract domain from Supabase email,
 *       look up existing client by domain, or create a new one
 * 4. Check for duplicate users (by Supabase ID and by client+email)
 * 5. Create the local user record
 *
 * The entire client-resolution + user-creation runs inside a Prisma
 * transaction so a failure at any step rolls everything back.
 */
export async function createVerifiedUser(
  supabaseAuthId: string,
  _supabaseEmail: string | null,
  input: CreateUserInput
): Promise<UserResponse> {
  const clientInput = input.client;

  logger.info('Creating verified user', {
    supabaseAuthId,
    hasClientId: !!clientInput.client_id,
    hasClientName: !!clientInput.client_name,
    email: input.email,
  });

  // Step 1: Verify the Supabase user exists via admin API
  const { data: supabaseUser, error: supabaseError } =
    await supabaseAdmin.auth.admin.getUserById(supabaseAuthId);

  if (supabaseError || !supabaseUser?.user) {
    logger.warn('Supabase user not found', {
      supabaseAuthId,
      error: supabaseError?.message,
    });
    throw new Error('Supabase user not found');
  }

  // Step 2: Verify email consistency — we trust Supabase, not the payload
  const verifiedEmail = supabaseUser.user.email;
  if (verifiedEmail && verifiedEmail !== input.email) {
    logger.warn('Email mismatch between Supabase and input', {
      supabaseEmail: verifiedEmail,
      inputEmail: input.email,
    });
    throw new Error(
      'Email does not match Supabase account. Use the email associated with your authentication.'
    );
  }

  const trustedEmail = verifiedEmail ?? input.email;

  // Step 3–6 run inside a transaction for atomicity
  const { user, client } = await prisma.$transaction(async (tx) => {
    // --- Resolve client ---
    let resolvedClientId: number;
    let resolvedClient: ClientResponse | null = null;

    if (clientInput.client_id) {
      // Path A: Attach to an existing client by ID
      const existingClient = await findClientById(clientInput.client_id, tx);

      if (!existingClient) {
        throw new Error('Client not found');
      }
      if (!existingClient.active) {
        throw new Error('Client account is inactive');
      }

      resolvedClientId = existingClient.id;
      resolvedClient = formatClientResponse(existingClient);
    } else {
      // Path B: Find-or-create client by domain derived from Supabase email
      const domain = extractDomainFromEmail(trustedEmail);
      const existingByDomain = await findClientByDomain(domain, tx);

      if (existingByDomain) {
        if (!existingByDomain.active) {
          throw new Error('Client account is inactive');
        }
        resolvedClientId = existingByDomain.id;
        resolvedClient = formatClientResponse(existingByDomain);

        logger.info('Matched existing client by domain', {
          domain,
          clientId: resolvedClientId,
        });
      } else {
        // Create a brand-new client
        resolvedClient = await clientCreate(
          {
            client_name: clientInput.client_name!,
            plan: clientInput.plan,
            details: clientInput.details,
            logo: clientInput.logo,
            cover_image: clientInput.cover_image,
            client_website: clientInput.client_website,
            client_x: clientInput.client_x,
            client_linkedin: clientInput.client_linkedin,
            client_instagram: clientInput.client_instagram,
            settings: clientInput.settings,
          },
          domain,
          tx
        );
        resolvedClientId = resolvedClient.id;

        logger.info('Created new client for user', {
          domain,
          clientId: resolvedClientId,
          slug: resolvedClient.slug,
        });
      }
    }

    // --- Duplicate checks ---
    const existingBySupabase = await findUserBySupabaseId(supabaseAuthId, tx);
    if (existingBySupabase) {
      throw new Error('User already exists for this Supabase account');
    }

    const existingByEmail = await findUserByClientEmail(
      resolvedClientId,
      trustedEmail,
      tx
    );
    if (existingByEmail) {
      throw new Error(
        'A user with this email already exists for this client'
      );
    }

    // --- Create user ---
    const userData: UserCreateData = {
      supabaseAuthId,
      clientId: resolvedClientId,
      email: trustedEmail,
      name: input.name,
      title: input.title,
      role: input.role,
      displayName: input.display_name,
      userName: input.user_name,
      imageUrl: input.image_url,
      userImage: input.user_image,
      userImageCover: input.user_image_cover,
      userBioDetail: input.user_bio_detail,
      userBioBrief: input.user_bio_brief,
      gender: input.gender,
    };

    const createdUser = await createUser(userData, tx);

    return { user: createdUser, client: resolvedClient };
  });

  logger.info('User created successfully', {
    userId: user.id,
    supabaseAuthId: user.supabaseAuthId,
    clientId: user.clientId,
  });

  const response = formatUserResponse(user);
  if (client) {
    response.client = client;
  }
  return response;
}

/**
 * Get the current user's profile from their Supabase auth ID
 */
export async function getUserBySupabaseId(
  supabaseAuthId: string
): Promise<UserResponse | null> {
  const user = await findUserBySupabaseId(supabaseAuthId);
  if (!user) return null;
  return formatUserResponse(user);
}

/**
 * Get user by internal ID
 */
export async function getUserById(
  userId: number
): Promise<UserResponse | null> {
  const user = await findUserById(userId);
  if (!user) return null;
  return formatUserResponse(user);
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: number,
  supabaseAuthId: string,
  input: UpdateUserInput
): Promise<UserResponse> {
  // Verify the user belongs to this Supabase account
  const existing = await findUserById(userId);
  if (!existing) {
    throw new Error('User not found');
  }

  if (existing.supabaseAuthId !== supabaseAuthId) {
    throw new Error('Not authorized to update this user');
  }

  const updateData: UserUpdateData = {
    name: input.name,
    title: input.title,
    displayName: input.display_name,
    userName: input.user_name,
    imageUrl: input.image_url,
    userImage: input.user_image,
    userImageCover: input.user_image_cover,
    userBioDetail: input.user_bio_detail,
    userBioBrief: input.user_bio_brief,
    gender: input.gender,
  };

  const user = await updateUser(userId, updateData);

  logger.info('User profile updated', { userId: user.id });

  return formatUserResponse(user);
}

/**
 * Format database user to API response
 */
function formatUserResponse(
  user: NonNullable<Awaited<ReturnType<typeof findUserBySupabaseId>>>
): UserResponse {
  return {
    id: user.id,
    supabase_auth_id: user.supabaseAuthId,
    client_id: user.clientId,
    email: user.email,
    name: user.name,
    title: user.title,
    role: user.role,
    active: user.active,
    verified: user.verified,
    display_name: user.displayName,
    user_name: user.userName,
    image_url: user.imageUrl,
    user_image: user.userImage,
    user_image_cover: user.userImageCover,
    user_bio_detail: user.userBioDetail,
    user_bio_brief: user.userBioBrief,
    gender: user.gender,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}
