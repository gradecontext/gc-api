/**
 * Leads Controller
 * Request/response handling for lead endpoints
 */

import { Context } from "hono";
import { z } from "zod";
import { logger } from "../../utils/logger";
import {
  createNewLead,
  getLeadById,
  listLeads,
  updateLeadDetails,
} from "./leads.service";

const clientPlanValues = ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"] as const;
const leadStatusValues = ["NEW", "CONTACTED", "PENDING", "APPROVED", "REJECTED", "CONVERTED"] as const;

const createLeadSchema = z.object({
  email: z.string().email(),
  full_name: z.string().optional(),
  company_name: z.string().optional(),
  company_size: z.string().optional(),
  company_website: z.string().optional(),
  plan_interest: z.enum(clientPlanValues).optional(),
  message: z.string().optional(),
});

const updateLeadSchema = z.object({
  full_name: z.string().optional(),
  company_name: z.string().optional(),
  company_size: z.string().optional(),
  company_website: z.string().optional(),
  plan_interest: z.enum(clientPlanValues).nullable().optional(),
  message: z.string().optional(),
  contacted: z.boolean().optional(),
  status: z.enum(leadStatusValues).optional(),
  represented_by: z.number().int().positive().nullable().optional(),
  converted_to_user_id: z.number().int().positive().nullable().optional(),
  converted_to_client_id: z.number().int().positive().nullable().optional(),
});

export async function createLeadHandler(c: Context) {
  try {
    const body = createLeadSchema.parse(await c.req.json());
    const lead = await createNewLead(body);
    return c.json({ success: true, data: lead }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { error: "Validation Error", message: "Invalid request body", details: error.errors },
        400,
      );
    }
    logger.error("Error creating lead", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function listLeadsHandler(c: Context) {
  try {
    const status = c.req.query("status");
    const contacted = c.req.query("contacted");
    const representedBy = c.req.query("represented_by");
    const page = c.req.query("page");
    const limit = c.req.query("limit");

    const result = await listLeads({
      status: status as typeof leadStatusValues[number] | undefined,
      contacted: contacted !== undefined ? contacted === "true" : undefined,
      represented_by: representedBy ? parseInt(representedBy, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return c.json(
      {
        success: true,
        data: result.leads,
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
    logger.error("Error listing leads", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function getLeadHandler(c: Context) {
  try {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) {
      return c.json({ error: "Bad Request", message: "Invalid lead ID" }, 400);
    }

    const lead = await getLeadById(id);
    if (!lead) {
      return c.json({ error: "Not Found", message: "Lead not found" }, 404);
    }

    return c.json({ success: true, data: lead }, 200);
  } catch (error) {
    logger.error("Error fetching lead", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function updateLeadHandler(c: Context) {
  try {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) {
      return c.json({ error: "Bad Request", message: "Invalid lead ID" }, 400);
    }

    const body = updateLeadSchema.parse(await c.req.json());
    const lead = await updateLeadDetails(id, body);
    return c.json({ success: true, data: lead }, 200);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { error: "Validation Error", message: "Invalid request body", details: error.errors },
        400,
      );
    }

    if (error instanceof Error) {
      const notFoundErrors = ["Lead not found", "Admin not found", "Converted user not found", "Converted client not found"];
      if (notFoundErrors.includes(error.message)) {
        return c.json({ error: "Not Found", message: error.message }, 404);
      }
      if (error.message === "Cannot assign lead to an inactive admin") {
        return c.json({ error: "Bad Request", message: error.message }, 400);
      }
    }

    logger.error("Error updating lead", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
