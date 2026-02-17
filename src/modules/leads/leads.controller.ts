/**
 * Leads Controller
 * Request/response handling for lead endpoints
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { logger } from '../../utils/logger';
import {
  createNewLead,
  getLeadById,
  listLeads,
  updateLeadDetails,
} from './leads.service';

const clientPlanValues = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as const;
const leadStatusValues = ['NEW', 'CONTACTED', 'PENDING', 'APPROVED', 'REJECTED', 'CONVERTED'] as const;

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

/**
 * POST /leads
 */
export async function createLeadHandler(
  request: FastifyRequest<{ Body: unknown }>,
  reply: FastifyReply
) {
  try {
    const body = createLeadSchema.parse(request.body);
    const lead = await createNewLead(body);
    reply.code(201).send({ success: true, data: lead });
  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.code(400).send({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: error.errors,
      });
      return;
    }
    logger.error('Error creating lead', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * GET /leads
 */
export async function listLeadsHandler(
  request: FastifyRequest<{
    Querystring: {
      status?: string;
      contacted?: string;
      represented_by?: string;
      page?: string;
      limit?: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const query = request.query;

    const result = await listLeads({
      status: query.status as typeof leadStatusValues[number] | undefined,
      contacted: query.contacted !== undefined ? query.contacted === 'true' : undefined,
      represented_by: query.represented_by ? parseInt(query.represented_by, 10) : undefined,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });

    reply.code(200).send({
      success: true,
      data: result.leads,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (error) {
    logger.error('Error listing leads', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * GET /leads/:id
 */
export async function getLeadHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      reply.code(400).send({ error: 'Bad Request', message: 'Invalid lead ID' });
      return;
    }

    const lead = await getLeadById(id);
    if (!lead) {
      reply.code(404).send({ error: 'Not Found', message: 'Lead not found' });
      return;
    }

    reply.code(200).send({ success: true, data: lead });
  } catch (error) {
    logger.error('Error fetching lead', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * PATCH /leads/:id
 */
export async function updateLeadHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
  reply: FastifyReply
) {
  try {
    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      reply.code(400).send({ error: 'Bad Request', message: 'Invalid lead ID' });
      return;
    }

    const body = updateLeadSchema.parse(request.body);
    const lead = await updateLeadDetails(id, body);
    reply.code(200).send({ success: true, data: lead });
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
      const notFoundErrors = ['Lead not found', 'Admin not found', 'Converted user not found', 'Converted client not found'];
      if (notFoundErrors.includes(error.message)) {
        reply.code(404).send({ error: 'Not Found', message: error.message });
        return;
      }
      if (error.message === 'Cannot assign lead to an inactive admin') {
        reply.code(400).send({ error: 'Bad Request', message: error.message });
        return;
      }
    }

    logger.error('Error updating lead', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
