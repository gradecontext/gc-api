/**
 * Users Controller
 * Request/response handling for user endpoints
 */

import { Context } from "hono";
import { z } from "zod";
import { logger } from "../../utils/logger";
import {
  createVerifiedUser,
  getUserBySupabaseId,
  getUserById,
  updateUserProfile,
  type CreateUserResult,
} from "./users.service";

const genderValues = [
  "MALE",
  "FEMALE",
  "NON_BINARY",
  "GENDERQUEER",
  "GENDERFLUID",
  "AGENDER",
  "BIGENDER",
  "TWO_SPIRIT",
  "TRANSGENDER_MALE",
  "TRANSGENDER_FEMALE",
  "INTERSEX",
  "PREFER_NOT_TO_SAY",
  "OTHER",
] as const;

const clientInputSchema = z
  .object({
    client_id: z.number().int().positive().optional(),
    client_name: z.string().min(1).optional(),
    plan: z
      .enum(["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"])
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
        "Company data missing. Either client_id or client_name is required.",
    },
  );

const createUserSchema = z.object({
  client: clientInputSchema,
  email: z.string().email(),
  name: z.string().min(1).optional(),
  title: z.string().optional(),
  role: z
    .enum(["OWNER", "ADMIN", "APPROVER", "VIEWER"])
    .optional()
    .default("VIEWER"),
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
 */
export async function createUserHandler(c: Context) {
  try {
    const supabaseUserId = c.get("supabaseUserId") as string | null;
    const supabaseUserEmail = c.get("supabaseUserEmail") as string | null;

    if (!supabaseUserId) {
      return c.json(
        { error: "Unauthorized", message: "Valid Supabase session is required to create a user" },
        401,
      );
    }

    const body = createUserSchema.parse(await c.req.json());

    logger.info("User creation request received", {
      supabaseUserId,
      hasClientId: !!body.client.client_id,
      hasClientName: !!body.client.client_name,
      email: body.email,
    });

    const result: CreateUserResult = await createVerifiedUser(
      supabaseUserId,
      supabaseUserEmail ?? null,
      body,
    );

    if (result.created) {
      return c.json(
        { success: true, message: "User created successfully", data: result.user },
        201,
      );
    } else {
      return c.json(
        { success: true, message: "User already registered", existing: true, data: result.user },
        200,
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { error: "Validation Error", message: "Invalid request body", details: error.errors },
        400,
      );
    }

    if (error instanceof Error) {
      const errorMap: Record<string, number> = {
        "Client not found": 404,
        "Client account is inactive": 403,
        "A user with this email already exists for this client": 409,
        "Email does not match Supabase account. Use the email associated with your authentication.": 400,
        "Company data missing. Either client_id or client_name is required.": 400,
      };

      const statusCode = errorMap[error.message];
      if (statusCode) {
        const errorLabel =
          statusCode === 409
            ? "Conflict"
            : statusCode === 403
              ? "Forbidden"
              : statusCode === 404
                ? "Not Found"
                : "Bad Request";

        return c.json({ error: errorLabel, message: error.message }, statusCode as any);
      }
    }

    logger.error(
      "Error creating user",
      error instanceof Error ? error : new Error(String(error)),
    );
    throw error;
  }
}

/**
 * GET /users/me
 */
export async function getMeHandler(c: Context) {
  try {
    const supabaseUserId = c.get("supabaseUserId") as string | null;

    if (!supabaseUserId) {
      return c.json({ error: "Unauthorized", message: "Valid session is required" }, 401);
    }

    const user = await getUserBySupabaseId(supabaseUserId);

    if (!user) {
      return c.json(
        { error: "Not Found", message: "User profile not found. Please create your profile first." },
        404,
      );
    }

    return c.json({ success: true, data: user }, 200);
  } catch (error) {
    logger.error(
      "Error fetching user profile",
      error instanceof Error ? error : new Error(String(error)),
    );
    throw error;
  }
}

/**
 * GET /users/:id
 */
export async function getUserHandler(c: Context) {
  try {
    const userId = parseInt(c.req.param("id"), 10);

    if (isNaN(userId)) {
      return c.json({ error: "Bad Request", message: "Invalid user ID" }, 400);
    }

    const user = await getUserById(userId);

    if (!user) {
      return c.json({ error: "Not Found", message: "User not found" }, 404);
    }

    return c.json({ success: true, data: user }, 200);
  } catch (error) {
    logger.error(
      "Error fetching user",
      error instanceof Error ? error : new Error(String(error)),
    );
    throw error;
  }
}

/**
 * PATCH /users/:id
 */
export async function updateUserHandler(c: Context) {
  try {
    const supabaseUserId = c.get("supabaseUserId") as string | null;

    if (!supabaseUserId) {
      return c.json({ error: "Unauthorized", message: "Valid session is required" }, 401);
    }

    const userId = parseInt(c.req.param("id"), 10);
    if (isNaN(userId)) {
      return c.json({ error: "Bad Request", message: "Invalid user ID" }, 400);
    }

    const body = updateUserSchema.parse(await c.req.json());
    const user = await updateUserProfile(userId, supabaseUserId, body);

    return c.json({ success: true, data: user }, 200);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { error: "Validation Error", message: "Invalid request body", details: error.errors },
        400,
      );
    }

    if (error instanceof Error) {
      if (error.message === "User not found") {
        return c.json({ error: "Not Found", message: error.message }, 404);
      }
      if (error.message === "Not authorized to update this user") {
        return c.json({ error: "Forbidden", message: error.message }, 403);
      }
    }

    logger.error(
      "Error updating user",
      error instanceof Error ? error : new Error(String(error)),
    );
    throw error;
  }
}
