/**
 * Admins Controller
 * Request/response handling for admin endpoints
 */

import { Context } from "hono";
import { z } from "zod";
import { logger } from "../../utils/logger";
import {
  createAdmin,
  findAdminById,
  findAdminByEmail,
  findAllAdmins,
  updateAdmin,
  deactivateAdmin,
} from "./admins.repository";
import { AdminResponse } from "./admins.types";

const accessLevelValues = ["SUPER_ADMIN", "STAFF", "DEVELOPER"] as const;

const createAdminSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  access_level: z.enum(accessLevelValues).optional().default("STAFF"),
});

const updateAdminSchema = z.object({
  full_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  access_level: z.enum(accessLevelValues).optional(),
  active: z.boolean().optional(),
});

function formatAdmin(admin: {
  id: number;
  fullName: string;
  email: string;
  active: boolean;
  accessLevel: string;
  createdAt: Date;
  updatedAt: Date;
}): AdminResponse {
  return {
    id: admin.id,
    full_name: admin.fullName,
    email: admin.email,
    active: admin.active,
    access_level: admin.accessLevel as AdminResponse["access_level"],
    created_at: admin.createdAt,
    updated_at: admin.updatedAt,
  };
}

export async function createAdminHandler(c: Context) {
  try {
    const body = createAdminSchema.parse(await c.req.json());

    const existing = await findAdminByEmail(body.email);
    if (existing) {
      return c.json(
        { error: "Conflict", message: "An admin with this email already exists" },
        409,
      );
    }

    const admin = await createAdmin({
      fullName: body.full_name,
      email: body.email,
      accessLevel: body.access_level,
    });

    return c.json({ success: true, data: formatAdmin(admin) }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { error: "Validation Error", message: "Invalid request body", details: error.errors },
        400,
      );
    }
    logger.error("Error creating admin", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function listAdminsHandler(c: Context) {
  try {
    const activeOnly = c.req.query("active_only") === "true";
    const admins = await findAllAdmins(activeOnly);
    return c.json({ success: true, data: admins.map(formatAdmin) }, 200);
  } catch (error) {
    logger.error("Error listing admins", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function getAdminHandler(c: Context) {
  try {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) {
      return c.json({ error: "Bad Request", message: "Invalid admin ID" }, 400);
    }

    const admin = await findAdminById(id);
    if (!admin) {
      return c.json({ error: "Not Found", message: "Admin not found" }, 404);
    }

    return c.json({ success: true, data: formatAdmin(admin) }, 200);
  } catch (error) {
    logger.error("Error fetching admin", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function updateAdminHandler(c: Context) {
  try {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) {
      return c.json({ error: "Bad Request", message: "Invalid admin ID" }, 400);
    }

    const existing = await findAdminById(id);
    if (!existing) {
      return c.json({ error: "Not Found", message: "Admin not found" }, 404);
    }

    const body = updateAdminSchema.parse(await c.req.json());

    const admin = await updateAdmin(id, {
      fullName: body.full_name,
      email: body.email,
      accessLevel: body.access_level,
      active: body.active,
    });

    return c.json({ success: true, data: formatAdmin(admin) }, 200);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { error: "Validation Error", message: "Invalid request body", details: error.errors },
        400,
      );
    }
    logger.error("Error updating admin", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function deleteAdminHandler(c: Context) {
  try {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) {
      return c.json({ error: "Bad Request", message: "Invalid admin ID" }, 400);
    }

    const existing = await findAdminById(id);
    if (!existing) {
      return c.json({ error: "Not Found", message: "Admin not found" }, 404);
    }

    const admin = await deactivateAdmin(id);
    return c.json({ success: true, data: formatAdmin(admin) }, 200);
  } catch (error) {
    logger.error("Error deactivating admin", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
