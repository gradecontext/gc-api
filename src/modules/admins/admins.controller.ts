/**
 * Admins Controller
 * Request/response handling for admin endpoints
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { logger } from '../../utils/logger';
import {
  createAdmin,
  findAdminById,
  findAdminByEmail,
  findAllAdmins,
  updateAdmin,
  deactivateAdmin,
} from './admins.repository';
import { AdminResponse } from './admins.types';

const accessLevelValues = ['SUPER_ADMIN', 'STAFF', 'DEVELOPER'] as const;

const createAdminSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  access_level: z.enum(accessLevelValues).optional().default('STAFF'),
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
    access_level: admin.accessLevel as AdminResponse['access_level'],
    created_at: admin.createdAt,
    updated_at: admin.updatedAt,
  };
}

/**
 * POST /admins
 */
export async function createAdminHandler(
  request: FastifyRequest<{ Body: unknown }>,
  reply: FastifyReply
) {
  try {
    const body = createAdminSchema.parse(request.body);

    const existing = await findAdminByEmail(body.email);
    if (existing) {
      reply.code(409).send({
        error: 'Conflict',
        message: 'An admin with this email already exists',
      });
      return;
    }

    const admin = await createAdmin({
      fullName: body.full_name,
      email: body.email,
      accessLevel: body.access_level,
    });

    reply.code(201).send({ success: true, data: formatAdmin(admin) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.code(400).send({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: error.errors,
      });
      return;
    }
    logger.error('Error creating admin', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * GET /admins
 */
export async function listAdminsHandler(
  request: FastifyRequest<{ Querystring: { active_only?: string } }>,
  reply: FastifyReply
) {
  try {
    const activeOnly = request.query.active_only === 'true';
    const admins = await findAllAdmins(activeOnly);
    reply.code(200).send({ success: true, data: admins.map(formatAdmin) });
  } catch (error) {
    logger.error('Error listing admins', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * GET /admins/:id
 */
export async function getAdminHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      reply.code(400).send({ error: 'Bad Request', message: 'Invalid admin ID' });
      return;
    }

    const admin = await findAdminById(id);
    if (!admin) {
      reply.code(404).send({ error: 'Not Found', message: 'Admin not found' });
      return;
    }

    reply.code(200).send({ success: true, data: formatAdmin(admin) });
  } catch (error) {
    logger.error('Error fetching admin', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * PATCH /admins/:id
 */
export async function updateAdminHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
  reply: FastifyReply
) {
  try {
    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      reply.code(400).send({ error: 'Bad Request', message: 'Invalid admin ID' });
      return;
    }

    const existing = await findAdminById(id);
    if (!existing) {
      reply.code(404).send({ error: 'Not Found', message: 'Admin not found' });
      return;
    }

    const body = updateAdminSchema.parse(request.body);

    const admin = await updateAdmin(id, {
      fullName: body.full_name,
      email: body.email,
      accessLevel: body.access_level,
      active: body.active,
    });

    reply.code(200).send({ success: true, data: formatAdmin(admin) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.code(400).send({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: error.errors,
      });
      return;
    }
    logger.error('Error updating admin', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * DELETE /admins/:id (soft delete — deactivates)
 */
export async function deleteAdminHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      reply.code(400).send({ error: 'Bad Request', message: 'Invalid admin ID' });
      return;
    }

    const existing = await findAdminById(id);
    if (!existing) {
      reply.code(404).send({ error: 'Not Found', message: 'Admin not found' });
      return;
    }

    const admin = await deactivateAdmin(id);
    reply.code(200).send({ success: true, data: formatAdmin(admin) });
  } catch (error) {
    logger.error('Error deactivating admin', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
