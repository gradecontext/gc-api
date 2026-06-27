/**
 * Users Service
 * Business logic for user creation and the self-onboarding flow
 *
 * Onboarding scenarios:
 *
 * Case A — New company:
 *   User signs up → creates Client → Membership(ADMIN, ACTIVE)
 *
 * Case B — Existing company:
 *   User signs up → Membership(STAFF, PENDING)
 *   Unless email domain matches client domain (and is not a public provider),
 *   in which case auto-approve → Membership(STAFF, ACTIVE)
 *
 * Case C — Returning user joining another org:
 *   User already exists → create additional Membership (same rules as B)
 */

import { Prisma } from "@prisma/client";
import { logger } from "../../utils/logger";
import { prisma } from "../../db/client";
import {
  createUser,
  findUserBySupabaseId,
  findUserByEmail,
  findUserById,
  findUserByUserName,
  updateUser,
  UserCreateData,
  UserUpdateData,
} from "./users.repository";
import {
  CreateUserInput,
  UpdateUserInput,
  UserResponse,
  MembershipResponse,
} from "./users.types";
import {
  findClientById,
  findClientByDomain,
  updateClientAuditFields,
} from "../clients/clients.repository";
import {
  clientCreate,
  extractDomainFromEmail,
  isPublicEmailDomain,
  formatClientResponse,
  generateRandomKey,
} from "../clients/clients.service";
import { ClientResponse } from "../clients/clients.types";
import {
  createMembership,
  findMembershipByUserAndClient,
} from "../memberships/memberships.repository";
import { notifyClientAdmins } from "../notifications/notifications.service";

export interface CreateUserResult {
  user: UserResponse;
  created: boolean;
  membership_status: string;
}

/**
 * Resolve the username to persist for a newly created user.
 *
 * If the caller requested a specific username, it's used as-is (after
 * confirming it's free). Otherwise one is derived from the email's local
 * part, appending a random suffix on collision until a free one is found.
 */
async function resolveUserNameForCreate(
  requested: string | undefined,
  email: string,
  tx: Prisma.TransactionClient,
): Promise<string> {
  if (requested) {
    const taken = await findUserByUserName(requested, tx);
    if (taken) throw new Error("Username is already taken");
    return requested;
  }

  const base =
    email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 90) || "user";

  let candidate = base;
  while (await findUserByUserName(candidate, tx)) {
    candidate = `${base}${generateRandomKey(4).toLowerCase()}`;
  }
  return candidate;
}

/**
 * Create (or find) a user and set up their membership for the specified company.
 *
 * The entire flow runs inside a Prisma transaction so a failure at any step
 * rolls everything back.
 */
export async function createVerifiedUser(
  supabaseAuthId: string,
  supabaseEmail: string | null,
  input: CreateUserInput,
): Promise<CreateUserResult> {
  const clientInput = input.client;

  logger.info("Creating verified user", {
    supabaseAuthId,
    hasClientId: !!clientInput.client_id,
    hasClientName: !!clientInput.client_name,
    email: input.email,
  });

  if (supabaseEmail && supabaseEmail !== input.email) {
    logger.warn("Email mismatch between Supabase JWT and input", {
      supabaseEmail,
      inputEmail: input.email,
    });
    throw new Error(
      "Email does not match Supabase account. Use the email associated with your authentication.",
    );
  }

  const trustedEmail = supabaseEmail ?? input.email;

  // Check if this Supabase account already has a user record.
  const existingUser = await findUserBySupabaseId(supabaseAuthId);

  // Run everything in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // --- Resolve or create the user identity ---
    let user: NonNullable<Awaited<ReturnType<typeof createUser>>>;
    let userCreated = false;

    if (existingUser) {
      user = existingUser;
    } else {
      // Also check by email — a user record may have been pre-created
      const existingByEmail = await findUserByEmail(trustedEmail, tx);
      if (existingByEmail) {
        user = existingByEmail;
      } else {
        const userName = await resolveUserNameForCreate(
          input.user_name,
          trustedEmail,
          tx,
        );

        const userData: UserCreateData = {
          supabaseAuthId,
          email: trustedEmail,
          name: input.name,
          title: input.title,
          displayName: input.display_name,
          userName,
          imageUrl: input.image_url,
          userImage: input.user_image,
          userImageCover: input.user_image_cover,
          userBioDetail: input.user_bio_detail,
          userBioBrief: input.user_bio_brief,
          gender: input.gender,
        };
        user = await createUser(userData, tx);
        userCreated = true;
      }
    }

    // --- Resolve client ---
    let resolvedClientId: number;
    let resolvedClient: ClientResponse | null = null;
    let isNewClient = false;

    if (clientInput.client_id) {
      const existingClient = await findClientById(clientInput.client_id, tx);
      if (!existingClient) throw new Error("Client not found");
      if (!existingClient.active) throw new Error("Client account is inactive");
      resolvedClientId = existingClient.id;
      resolvedClient = formatClientResponse(existingClient);
    } else {
      const domain = extractDomainFromEmail(trustedEmail);
      const isPublicDomain = isPublicEmailDomain(domain);

      const existingByDomain = isPublicDomain
        ? null
        : await findClientByDomain(domain, tx);

      if (existingByDomain) {
        if (!existingByDomain.active) throw new Error("Client account is inactive");
        resolvedClientId = existingByDomain.id;
        resolvedClient = formatClientResponse(existingByDomain);

        logger.info("Matched existing client by domain", {
          domain,
          clientId: resolvedClientId,
        });
      } else {
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
          isPublicDomain ? undefined : domain,
          tx,
        );
        resolvedClientId = resolvedClient.id;
        isNewClient = true;

        logger.info("Created new client for user", {
          domain: isPublicDomain ? "(public domain, not stored)" : domain,
          clientId: resolvedClientId,
          slug: resolvedClient.slug,
        });
      }
    }

    // --- Check for existing membership ---
    const existingMembership = await findMembershipByUserAndClient(
      user.id,
      resolvedClientId,
      tx,
    );
    if (existingMembership) {
      throw new Error("You already have a membership for this organization");
    }

    // --- Determine membership role & status ---
    let membershipRole: "ADMIN" | "STAFF";
    let membershipStatus: "PENDING" | "ACTIVE";

    if (isNewClient) {
      // First person to create this company → ADMIN + ACTIVE
      membershipRole = "ADMIN";
      membershipStatus = "ACTIVE";
    } else {
      // Joining an existing company → STAFF (admins can promote later)
      membershipRole = "STAFF";

      // Auto-approve if email domain matches client domain (and is not a public provider)
      const userDomain = extractDomainFromEmail(trustedEmail);
      const clientDomain = resolvedClient?.domain;

      if (clientDomain && !isPublicEmailDomain(userDomain) && userDomain === clientDomain) {
        membershipStatus = "ACTIVE";
        logger.info("Auto-approving membership via domain match", {
          userDomain,
          clientDomain,
        });
      } else {
        membershipStatus = "PENDING";
      }
    }

    // --- Create membership ---
    const membership = await createMembership(
      {
        userId: user.id,
        clientId: resolvedClientId,
        role: membershipRole,
        status: membershipStatus,
      },
      tx,
    );

    // Set audit fields on newly created clients
    if (isNewClient && resolvedClient && resolvedClient.added_by === null) {
      const updatedClient = await updateClientAuditFields(
        resolvedClientId,
        user.id,
        tx,
      );
      resolvedClient = formatClientResponse(updatedClient);
    }

    // --- Notify client admins if membership is pending ---
    if (membershipStatus === "PENDING") {
      await notifyClientAdmins(
        resolvedClientId,
        user.id,
        {
          type: "MEMBERSHIP_REQUEST",
          title: "New membership request",
          message: `${user.name ?? user.email} has requested to join your organization.`,
          metadata: {
            membershipId: membership.id,
            requestingUserId: user.id,
            requestingUserEmail: user.email,
            requestingUserName: user.name,
          },
        },
        tx,
      );
    }

    return {
      user,
      resolvedClient,
      userCreated,
      membershipStatus,
    };
  });

  logger.info("User onboarding completed", {
    userId: result.user.id,
    supabaseAuthId: result.user.supabaseAuthId,
    membershipStatus: result.membershipStatus,
    userCreated: result.userCreated,
  });

  // Re-fetch the user to get fresh membership data (the in-transaction user
  // was created before the membership was attached).
  const freshUser = await findUserBySupabaseId(supabaseAuthId);
  const response = formatUserResponse(freshUser ?? result.user);

  if (result.resolvedClient) {
    response.client = result.resolvedClient;
  }

  return {
    user: response,
    created: result.userCreated,
    membership_status: result.membershipStatus,
  };
}

/**
 * Get the current user's profile from their Supabase auth ID.
 *
 * `requestedClientId` lets a multi-company user pin which membership's
 * client should be surfaced as the top-level `client` field (e.g. via an
 * X-Client-Id header). If omitted, it's auto-selected only when the user
 * has exactly one ACTIVE membership.
 */
export async function getUserBySupabaseId(
  supabaseAuthId: string,
  requestedClientId: number | null = null,
): Promise<UserResponse | null> {
  const user = await findUserBySupabaseId(supabaseAuthId);
  if (!user) return null;
  return formatUserResponse(user, requestedClientId);
}

/**
 * Get user by internal ID
 */
export async function getUserById(
  userId: number,
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
  input: UpdateUserInput,
): Promise<UserResponse> {
  const existing = await findUserById(userId);
  if (!existing) throw new Error("User not found");
  if (existing.supabaseAuthId !== supabaseAuthId) {
    throw new Error("Not authorized to update this user");
  }

  if (input.user_name && input.user_name !== existing.userName) {
    const taken = await findUserByUserName(input.user_name);
    if (taken) throw new Error("Username is already taken");
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
  logger.info("User profile updated", { userId: user.id });
  return formatUserResponse(user);
}

/**
 * Format database user to API response.
 *
 * `requestedClientId` resolves which membership's client gets surfaced as
 * the top-level `client` field — see resolveCurrentClient.
 */
function formatUserResponse(
  user: NonNullable<Awaited<ReturnType<typeof findUserBySupabaseId>>>,
  requestedClientId: number | null = null,
): UserResponse {
  const memberships = (user.memberships ?? []).map(formatMembershipResponse);

  return {
    id: user.id,
    supabase_auth_id: user.supabaseAuthId,
    email: user.email,
    name: user.name,
    title: user.title,
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
    memberships,
    client: resolveCurrentClient(memberships, requestedClientId),
  };
}

function formatMembershipResponse(
  m: NonNullable<Awaited<ReturnType<typeof findUserBySupabaseId>>>["memberships"][number],
): MembershipResponse {
  return {
    id: m.id,
    client_id: m.clientId,
    role: m.role,
    status: m.status,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
    client: m.client
      ? {
          id: m.client.id,
          name: m.client.name,
          slug: m.client.slug,
          domain: m.client.domain,
          logo: m.client.logo,
          cover_image: m.client.coverImage,
          details: m.client.details,
          client_website: m.client.clientWebsite,
          client_x: m.client.clientX,
          client_linkedin: m.client.clientLinkedin,
          client_instagram: m.client.clientInstagram,
          verified: m.client.verified,
          plan: m.client.plan,
          active: m.client.active,
        }
      : undefined,
  };
}

/**
 * Resolve which membership's client should be surfaced as the user's
 * "current" company — same priority as the auth middleware's clientId
 * resolution (X-Client-Id header, else the sole ACTIVE membership):
 *
 * 1. requestedClientId, if it matches an ACTIVE membership
 * 2. The user's only ACTIVE membership, if they have exactly one
 * 3. Otherwise undefined (ambiguous — caller should rely on `memberships`)
 */
function resolveCurrentClient(
  memberships: MembershipResponse[],
  requestedClientId: number | null,
): MembershipResponse["client"] {
  const activeMemberships = memberships.filter((m) => m.status === "ACTIVE");

  if (requestedClientId) {
    return activeMemberships.find((m) => m.client_id === requestedClientId)?.client;
  }

  if (activeMemberships.length === 1) {
    return activeMemberships[0].client;
  }

  return undefined;
}
