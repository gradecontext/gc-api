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
 *   User signs up → Membership(VIEWER, PENDING)
 *   Unless email domain matches client domain (and is not a public provider),
 *   in which case auto-approve → Membership(VIEWER, ACTIVE)
 *
 * Case C — Returning user joining another org:
 *   User already exists → create additional Membership (same rules as B)
 */

import { logger } from "../../utils/logger";
import { prisma } from "../../db/client";
import {
  createUser,
  findUserBySupabaseId,
  findUserByEmail,
  findUserById,
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
        const userData: UserCreateData = {
          supabaseAuthId,
          email: trustedEmail,
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
    let membershipRole: "OWNER" | "ADMIN" | "APPROVER" | "VIEWER";
    let membershipStatus: "PENDING" | "ACTIVE";

    if (isNewClient) {
      // First person to create this company → ADMIN + ACTIVE
      membershipRole = "ADMIN";
      membershipStatus = "ACTIVE";
    } else {
      // Joining an existing company
      membershipRole = "VIEWER";

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
 * Get the current user's profile from their Supabase auth ID
 */
export async function getUserBySupabaseId(
  supabaseAuthId: string,
): Promise<UserResponse | null> {
  const user = await findUserBySupabaseId(supabaseAuthId);
  if (!user) return null;
  return formatUserResponse(user);
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
 * Format database user to API response
 */
function formatUserResponse(
  user: NonNullable<Awaited<ReturnType<typeof findUserBySupabaseId>>>,
): UserResponse {
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
    memberships: (user.memberships ?? []).map(formatMembershipResponse),
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
          plan: m.client.plan,
          active: m.client.active,
        }
      : undefined,
  };
}
