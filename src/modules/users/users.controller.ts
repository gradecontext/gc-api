/**
 * Users Controller
 * Request/response handling for user endpoints
 *
 * Handles validation, authentication extraction, and response formatting
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { logger } from '../../utils/logger';
import { SessionRequest } from '../../middleware/session.middleware';
import {
  createVerifiedUser,
  getUserBySupabaseId,
  getUserById,
  updateUserProfile,
} from './users.service';

// Validation schemas
const genderValues = [
  'MALE',
  'FEMALE',
  'NON_BINARY',
  'GENDERQUEER',
  'GENDERFLUID',
  'AGENDER',
  'BIGENDER',
  'TWO_SPIRIT',
  'TRANSGENDER_MALE',
  'TRANSGENDER_FEMALE',
  'INTERSEX',
  'PREFER_NOT_TO_SAY',
  'OTHER',
] as const;

/**
 * Client sub-schema for user creation.
 * Either `client_id` (existing client) or `client_name` (find-or-create) is required.
 */
const clientInputSchema = z
  .object({
    client_id: z.number().int().positive().optional(),
    client_name: z.string().min(1).optional(),
    plan: z
      .enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'])
      .optional(),
    details: z.string().optional(),
    logo: z.string().optional(),
    cover_image: z.string().optional(),
    client_website: z.string().optional(),
    client_x: z.string().optional(),
    client_linkedin: z.string().optional(),
    client_instagram: z.string().optional(),
    settings: z.record(z.unknown()).optional(),
  })
  .refine(
    (data) =>
      data.client_id !== undefined ||
      (data.client_name !== undefined && data.client_name.trim().length > 0),
    {
      message:
        'Company data missing. Either client_id or client_name is required.',
    }
  );

const createUserSchema = z.object({
  client: clientInputSchema,
  email: z.string().email(),
  name: z.string().min(1).optional(),
  title: z.string().optional(),
  role: z
    .enum(['OWNER', 'ADMIN', 'APPROVER', 'VIEWER'])
    .optional()
    .default('VIEWER'),
  display_name: z.string().max(150).optional(),
  user_name: z.string().max(100).optional(),
  image_url: z.string().url().optional(),
  user_image: z.string().optional(),
  user_image_cover: z.string().optional(),
  user_bio_detail: z.string().optional(),
  user_bio_brief: z.string().max(255).optional(),
  gender: z.enum(genderValues).optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  title: z.string().optional(),
  display_name: z.string().max(150).optional(),
  user_name: z.string().max(100).optional(),
  image_url: z.string().url().optional(),
  user_image: z.string().optional(),
  user_image_cover: z.string().optional(),
  user_bio_detail: z.string().optional(),
  user_bio_brief: z.string().max(255).optional(),
  gender: z.enum(genderValues).nullable().optional(),
});

/**
 * POST /users
 * Create a new user (requires valid Supabase session)
 *
 * The user must be authenticated via Supabase JWT.
 * The endpoint verifies the Supabase user exists before creating
 * the local user record and resolving/creating the associated client.
 */
export async function createUserHandler(
  request: FastifyRequest<{ Body: unknown }>,
  reply: FastifyReply
) {
  try {
    const sessionReq = request as SessionRequest;
    const supabaseUserId = sessionReq.supabaseUserId;
    const supabaseUserEmail = sessionReq.supabaseUserEmail;

    if (!supabaseUserId) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Valid Supabase session is required to create a user',
      });
      return;
    }

    const body = createUserSchema.parse(request.body);

    logger.info('User creation request received', {
      supabaseUserId,
      hasClientId: !!body.client.client_id,
      hasClientName: !!body.client.client_name,
      email: body.email,
    });

    const user = await createVerifiedUser(
      supabaseUserId,
      supabaseUserEmail ?? null,
      body
    );

    reply.code(201).send({
      success: true,
      data: user,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.code(400).send({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: error.errors,
      });
      return;
    }

    if (error instanceof Error) {
      const errorMap: Record<string, number> = {
        'Supabase user not found': 404,
        'Client not found': 404,
        'Client account is inactive': 403,
        'User already exists for this Supabase account': 409,
        'A user with this email already exists for this client': 409,
        'Email does not match Supabase account. Use the email associated with your authentication.': 400,
        'Company data missing. Either client_id or client_name is required.': 400,
      };

      const statusCode = errorMap[error.message];
      if (statusCode) {
        const errorLabel =
          statusCode === 409
            ? 'Conflict'
            : statusCode === 403
              ? 'Forbidden'
              : statusCode === 404
                ? 'Not Found'
                : 'Bad Request';

        reply.code(statusCode).send({
          error: errorLabel,
          message: error.message,
        });
        return;
      }
    }

    logger.error(
      'Error creating user',
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
}

/**
 * GET /users/me
 * Get the current authenticated user's profile
 */
export async function getMeHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const sessionReq = request as SessionRequest;
    const supabaseUserId = sessionReq.supabaseUserId;

    if (!supabaseUserId) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Valid session is required',
      });
      return;
    }

    const user = await getUserBySupabaseId(supabaseUserId);

    if (!user) {
      reply.code(404).send({
        error: 'Not Found',
        message: 'User profile not found. Please create your profile first.',
      });
      return;
    }

    reply.code(200).send({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error(
      'Error fetching user profile',
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
}

/**
 * GET /users/:id
 * Get a user by internal ID
 */
export async function getUserHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const userId = parseInt(request.params.id, 10);

    if (isNaN(userId)) {
      reply.code(400).send({
        error: 'Bad Request',
        message: 'Invalid user ID',
      });
      return;
    }

    const user = await getUserById(userId);

    if (!user) {
      reply.code(404).send({
        error: 'Not Found',
        message: 'User not found',
      });
      return;
    }

    reply.code(200).send({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error(
      'Error fetching user',
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
}

/**
 * PATCH /users/:id
 * Update a user's profile (only the user themselves can update)
 */
export async function updateUserHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
  reply: FastifyReply
) {
  try {
    const sessionReq = request as SessionRequest;
    const supabaseUserId = sessionReq.supabaseUserId;

    if (!supabaseUserId) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Valid session is required',
      });
      return;
    }

    const userId = parseInt(request.params.id, 10);
    if (isNaN(userId)) {
      reply.code(400).send({
        error: 'Bad Request',
        message: 'Invalid user ID',
      });
      return;
    }

    const body = updateUserSchema.parse(request.body);

    const user = await updateUserProfile(userId, supabaseUserId, body);

    reply.code(200).send({
      success: true,
      data: user,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.code(400).send({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: error.errors,
      });
      return;
    }

    if (error instanceof Error) {
      if (error.message === 'User not found') {
        reply.code(404).send({ error: 'Not Found', message: error.message });
        return;
      }
      if (error.message === 'Not authorized to update this user') {
        reply.code(403).send({ error: 'Forbidden', message: error.message });
        return;
      }
    }

    logger.error(
      'Error updating user',
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
}
