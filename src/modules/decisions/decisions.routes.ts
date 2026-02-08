/**
 * Decisions Routes
 * Fastify route definitions for decision endpoints
 */

import { FastifyInstance } from 'fastify';
import {
  createDecisionHandler,
  reviewDecisionHandler,
  getDecisionHandler,
} from './decisions.controller';
import { authenticate } from '../../middleware/auth.middleware';

export async function decisionsRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('onRequest', authenticate);

  // POST /decisions - Create decision (webhook entry point)
  fastify.post('/decisions', {
    schema: {
      description: 'Create a new decision',
      tags: ['decisions'],
      body: {
        type: 'object',
        required: ['tenant_id', 'subject_company', 'decision_type'],
        properties: {
          tenant_id: { type: 'string', format: 'uuid' },
          subject_company: {
            type: 'object',
            required: ['external_id', 'name'],
            properties: {
              external_id: { type: 'string' },
              name: { type: 'string' },
              domain: { type: 'string' },
              industry: { type: 'string' },
              country: { type: 'string' },
            },
          },
          deal: {
            type: 'object',
            properties: {
              crm_deal_id: { type: 'string' },
              amount: { type: 'number' },
              currency: { type: 'string' },
              discount_requested: { type: 'number' },
            },
          },
          decision_type: {
            type: 'string',
            enum: ['DISCOUNT', 'ONBOARDING', 'PAYMENT_TERMS', 'CREDIT_EXTENSION', 'PARTNERSHIP', 'RENEWAL', 'ESCALATION', 'CUSTOM'],
          },
          context_key: { type: 'string' },
        },
      },
      response: {
        201: {
          type: 'object',
          description: 'Decision created successfully',
        },
      },
    },
  }, createDecisionHandler);

  // POST /decisions/:id/review - Human review
  fastify.post('/decisions/:id/review', {
    schema: {
      description: 'Review a decision (human action)',
      tags: ['decisions'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['action'],
        properties: {
          action: {
            type: 'string',
            enum: ['approve', 'reject', 'override', 'escalate'],
          },
          note: { type: 'string' },
          final_action: { type: 'string' },
        },
      },
    },
  }, reviewDecisionHandler);

  // GET /decisions/:id - Fetch decision
  fastify.get('/decisions/:id', {
    schema: {
      description: 'Get decision by ID with full context',
      tags: ['decisions'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, getDecisionHandler);
}
