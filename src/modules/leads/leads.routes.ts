/**
 * Leads Routes
 * Fastify route definitions for lead endpoints
 */

import { FastifyInstance } from 'fastify';
import {
  createLeadHandler,
  listLeadsHandler,
  getLeadHandler,
  updateLeadHandler,
} from './leads.controller';
import { authenticate } from '../../middleware/auth.middleware';

export async function leadsRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  // POST /leads - Create lead
  fastify.post('/leads', {
    schema: {
      description: 'Create a new lead',
      tags: ['leads'],
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
          full_name: { type: 'string' },
          company_name: { type: 'string' },
          company_size: { type: 'string' },
          company_website: { type: 'string' },
          plan_interest: {
            type: 'string',
            enum: ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
          },
          message: { type: 'string' },
        },
      },
      response: { 201: { type: 'object', description: 'Lead created' } },
    },
  }, createLeadHandler);

  // GET /leads - List leads with filtering
  fastify.get('/leads', {
    schema: {
      description: 'List leads with optional filters',
      tags: ['leads'],
      querystring: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['NEW', 'CONTACTED', 'PENDING', 'APPROVED', 'REJECTED', 'CONVERTED'],
          },
          contacted: { type: 'string', enum: ['true', 'false'] },
          represented_by: { type: 'string', pattern: '^[0-9]+$' },
          page: { type: 'string', pattern: '^[0-9]+$' },
          limit: { type: 'string', pattern: '^[0-9]+$' },
        },
      },
      response: { 200: { type: 'object', description: 'Paginated leads' } },
    },
  }, listLeadsHandler);

  // GET /leads/:id
  fastify.get('/leads/:id', {
    schema: {
      description: 'Get lead by ID',
      tags: ['leads'],
      params: {
        type: 'object',
        properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
      },
      response: { 200: { type: 'object', description: 'Lead details' } },
    },
  }, getLeadHandler);

  // PATCH /leads/:id - Update lead (status, assignment, conversion, etc.)
  fastify.patch('/leads/:id', {
    schema: {
      description: 'Update lead details, status, or convert',
      tags: ['leads'],
      params: {
        type: 'object',
        properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
      },
      body: {
        type: 'object',
        properties: {
          full_name: { type: 'string' },
          company_name: { type: 'string' },
          company_size: { type: 'string' },
          company_website: { type: 'string' },
          plan_interest: {
            type: ['string', 'null'],
            enum: ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE', null],
          },
          message: { type: 'string' },
          contacted: { type: 'boolean' },
          status: {
            type: 'string',
            enum: ['NEW', 'CONTACTED', 'PENDING', 'APPROVED', 'REJECTED', 'CONVERTED'],
          },
          represented_by: { type: ['integer', 'null'] },
          converted_to_user_id: { type: ['integer', 'null'] },
          converted_to_client_id: { type: ['integer', 'null'] },
        },
      },
      response: { 200: { type: 'object', description: 'Lead updated' } },
    },
  }, updateLeadHandler);
}
