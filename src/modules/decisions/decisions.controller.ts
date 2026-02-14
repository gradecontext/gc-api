/**
 * Decisions Controller
 * Request/response handling for decision endpoints
 * 
 * Handles validation, authentication, and response formatting
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { logger } from '../../utils/logger';
import {
  processDecisionCreation,
  processDecisionReview,
  getDecisionById,
} from './decisions.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

// Validation schemas
const createDecisionSchema = z.object({
  client_id: z.string().uuid(),
  subject_company: z.object({
    external_id: z.string().min(1),
    name: z.string().min(1),
    domain: z.string().url().optional().or(z.string().min(1).optional()),
    industry: z.string().optional(),
    country: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
  deal: z
    .object({
      crm_deal_id: z.string().optional(),
      amount: z.number().positive().optional(),
      currency: z.string().optional(),
      discount_requested: z.number().min(0).max(100).optional(),
    })
    .optional(),
  decision_type: z.enum([
    'DISCOUNT',
    'ONBOARDING',
    'PAYMENT_TERMS',
    'CREDIT_EXTENSION',
    'PARTNERSHIP',
    'RENEWAL',
    'ESCALATION',
    'CUSTOM',
  ]),
  context_key: z.string().optional(),
});

const reviewDecisionSchema = z.object({
  action: z.enum(['approve', 'reject', 'override', 'escalate']),
  note: z.string().optional(),
  final_action: z.string().optional(),
});

/**
 * POST /decisions
 * Create a new decision (webhook entry point)
 */
export async function createDecisionHandler(
  request: FastifyRequest<{ Body: unknown }>,
  reply: FastifyReply
) {
  try {
    // Validate request body
    const body = createDecisionSchema.parse(request.body);

    // If client was resolved from API key, use that; otherwise use body
    const authReq = request as AuthenticatedRequest;
    const clientId = authReq.clientId || body.client_id;

    logger.info('Decision creation request received', {
      clientId,
      companyName: body.subject_company.name,
      externalId: body.subject_company.external_id,
    });

    // Process decision creation (async orchestration)
    const decision = await processDecisionCreation({
      ...body,
      client_id: clientId,
    });

    reply.code(201).send(decision);
  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.code(400).send({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: error.errors,
      });
      return;
    }

    logger.error('Error creating decision', error instanceof Error ? error : new Error(String(error)));
    throw error; // Let error middleware handle it
  }
}

/**
 * POST /decisions/:id/review
 * Human review of a decision
 */
export async function reviewDecisionHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
  reply: FastifyReply
) {
  try {
    const decisionId = request.params.id;

    // Validate request body
    const body = reviewDecisionSchema.parse(request.body);

    // TODO: Extract user ID from authentication
    // For now, use a placeholder or require it in body
    const userId = (request as AuthenticatedRequest).userId || 'system';

    logger.info('Decision review request received', {
      decisionId,
      action: body.action,
    });

    const decision = await processDecisionReview(decisionId, userId, body);

    reply.code(200).send(decision);
  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.code(400).send({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: error.errors,
      });
      return;
    }

    if (error instanceof Error && error.message === 'Decision not found') {
      reply.code(404).send({
        error: 'Not Found',
        message: 'Decision not found',
      });
      return;
    }

    logger.error('Error reviewing decision', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * GET /decisions/:id
 * Fetch a decision with full context (audit view)
 */
export async function getDecisionHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const decisionId = request.params.id;

    // Extract client ID from auth for multi-client isolation
    const clientId = (request as AuthenticatedRequest).clientId;

    logger.debug('Fetching decision', { decisionId });

    const decision = await getDecisionById(decisionId, clientId);

    if (!decision) {
      reply.code(404).send({
        error: 'Not Found',
        message: 'Decision not found',
      });
      return;
    }

    reply.code(200).send(decision);
  } catch (error) {
    logger.error('Error fetching decision', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
