/**
 * Contact Messages Controller
 * Request/response handling for contact message endpoints
 */

import { Context } from "hono";
import { z } from "zod";
import { logger } from "../../utils/logger";
import {
  createContact,
  getContactById,
  listContacts,
  updateContactDetails,
} from "./contact.service";

const contactStatusValues = ["NEW", "IN_PROGRESS", "RESPONDED", "CLOSED", "SPAM"] as const;
const contactPriorityValues = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

const createContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  subject: z.string().min(1),
  message: z.string().min(1),
  source: z.string().optional(),
});

const updateContactSchema = z.object({
  status: z.enum(contactStatusValues).optional(),
  priority: z.enum(contactPriorityValues).optional(),
  contacted_by: z.number().int().positive().nullable().optional(),
});

export async function createContactHandler(c: Context) {
  try {
    const body = createContactSchema.parse(await c.req.json());

    const ipAddress =
      c.req.header("cf-connecting-ip") ??
      c.req.header("x-forwarded-for") ??
      undefined;
    const userAgent = c.req.header("user-agent") ?? undefined;

    const contact = await createContact(body, { ipAddress, userAgent });
    return c.json({ success: true, data: contact }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { error: "Validation Error", message: "Invalid request body", details: error.errors },
        400,
      );
    }
    logger.error("Error creating contact message", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function listContactsHandler(c: Context) {
  try {
    const status = c.req.query("status");
    const priority = c.req.query("priority");
    const contactedBy = c.req.query("contacted_by");
    const page = c.req.query("page");
    const limit = c.req.query("limit");

    const result = await listContacts({
      status: status as (typeof contactStatusValues)[number] | undefined,
      priority: priority as (typeof contactPriorityValues)[number] | undefined,
      contacted_by: contactedBy ? parseInt(contactedBy, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return c.json(
      {
        success: true,
        data: result.messages,
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
    logger.error("Error listing contact messages", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function getContactHandler(c: Context) {
  try {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) {
      return c.json({ error: "Bad Request", message: "Invalid contact message ID" }, 400);
    }

    const contact = await getContactById(id);
    if (!contact) {
      return c.json({ error: "Not Found", message: "Contact message not found" }, 404);
    }

    return c.json({ success: true, data: contact }, 200);
  } catch (error) {
    logger.error("Error fetching contact message", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function updateContactHandler(c: Context) {
  try {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) {
      return c.json({ error: "Bad Request", message: "Invalid contact message ID" }, 400);
    }

    const body = updateContactSchema.parse(await c.req.json());
    const contact = await updateContactDetails(id, body);
    return c.json({ success: true, data: contact }, 200);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { error: "Validation Error", message: "Invalid request body", details: error.errors },
        400,
      );
    }

    if (error instanceof Error) {
      if (error.message === "Contact message not found") {
        return c.json({ error: "Not Found", message: error.message }, 404);
      }
      if (error.message === "Admin not found") {
        return c.json({ error: "Not Found", message: error.message }, 404);
      }
      if (error.message === "Cannot assign contact message to an inactive admin") {
        return c.json({ error: "Bad Request", message: error.message }, 400);
      }
    }

    logger.error("Error updating contact message", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
