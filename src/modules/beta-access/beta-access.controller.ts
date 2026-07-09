/**
 * Beta Access List Controller
 * Request/response handling for beta access endpoints
 */

import { Context } from "hono";
import { z } from "zod";
import { logger } from "../../utils/logger";
import {
  createBetaAccessEntry,
  getBetaAccessById,
  listBetaAccessEntries,
  updateBetaAccessDetails,
} from "./beta-access.service";

const clientPlanValues = ["FREE", "GROWTH", "SCALE", "ENTERPRISE"] as const;

const createBetaAccessSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  company_name: z.string().optional(),
  number_of_users_range: z.string().optional(),
  source: z.string().optional(),
  plan_interest: z.enum(clientPlanValues).optional(),
  notes: z.string().optional(),
});

const updateBetaAccessSchema = z.object({
  full_name: z.string().min(1).optional(),
  company_name: z.string().optional(),
  number_of_users_range: z.string().optional(),
  source: z.string().optional(),
  plan_interest: z.enum(clientPlanValues).nullable().optional(),
  allow_access: z.boolean().optional(),
  approved_by: z.number().int().positive().nullable().optional(),
  notes: z.string().optional(),
});

export async function createBetaAccessHandler(c: Context) {
  try {
    const body = createBetaAccessSchema.parse(await c.req.json());
    const entry = await createBetaAccessEntry(body);
    return c.json({ success: true, data: entry }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { error: "Validation Error", message: "Invalid request body", details: error.errors },
        400,
      );
    }

    if (error instanceof Error && error.message === "Email already registered for beta access") {
      return c.json({ error: "Conflict", message: error.message }, 409);
    }

    logger.error("Error creating beta access entry", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function listBetaAccessHandler(c: Context) {
  try {
    const allowAccess = c.req.query("allow_access");
    const planInterest = c.req.query("plan_interest");
    const page = c.req.query("page");
    const limit = c.req.query("limit");

    const result = await listBetaAccessEntries({
      allow_access: allowAccess !== undefined ? allowAccess === "true" : undefined,
      plan_interest: planInterest as (typeof clientPlanValues)[number] | undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return c.json(
      {
        success: true,
        data: result.entries,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          pages: Math.ceil(result.total / result.limit),
        },
      },
      200,
    );
  } catch (error) {
    logger.error("Error listing beta access entries", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function getBetaAccessHandler(c: Context) {
  try {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) {
      return c.json({ error: "Bad Request", message: "Invalid beta access entry ID" }, 400);
    }

    const entry = await getBetaAccessById(id);
    if (!entry) {
      return c.json({ error: "Not Found", message: "Beta access entry not found" }, 404);
    }

    return c.json({ success: true, data: entry }, 200);
  } catch (error) {
    logger.error("Error fetching beta access entry", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function updateBetaAccessHandler(c: Context) {
  try {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) {
      return c.json({ error: "Bad Request", message: "Invalid beta access entry ID" }, 400);
    }

    const body = updateBetaAccessSchema.parse(await c.req.json());
    const entry = await updateBetaAccessDetails(id, body);
    return c.json({ success: true, data: entry }, 200);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { error: "Validation Error", message: "Invalid request body", details: error.errors },
        400,
      );
    }

    if (error instanceof Error) {
      if (error.message === "Beta access entry not found") {
        return c.json({ error: "Not Found", message: error.message }, 404);
      }
      if (error.message === "Admin not found") {
        return c.json({ error: "Not Found", message: error.message }, 404);
      }
      if (error.message === "Cannot assign approval to an inactive admin") {
        return c.json({ error: "Bad Request", message: error.message }, 400);
      }
    }

    logger.error("Error updating beta access entry", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
