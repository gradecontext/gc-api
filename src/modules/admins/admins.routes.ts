/**
 * Admins Routes
 * Fastify route definitions for admin endpoints
 */

import { FastifyInstance } from 'fastify';
import {
  createAdminHandler,
  listAdminsHandler,
  getAdminHandler,
  updateAdminHandler,
  deleteAdminHandler,
} from './admins.controller';
import { authenticate } from '../../middleware/auth.middleware';

export async function adminsRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  // POST /admins - Create admin
  fastify.post('/admins', {
    schema: {
      description: 'Create a new platform admin',
      tags: ['admins'],
      body: {
        type: 'object',
        required: ['full_name', 'email'],
        properties: {
          full_name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          access_level: {
            type: 'string',
            enum: ['SUPER_ADMIN', 'STAFF', 'DEVELOPER'],
          },
        },
      },
      response: { 201: { type: 'object', description: 'Admin created' } },
    },
  }, createAdminHandler);

  // GET /admins - List admins
  fastify.get('/admins', {
    schema: {
      description: 'List all admins',
      tags: ['admins'],
      querystring: {
        type: 'object',
        properties: {
          active_only: { type: 'string', enum: ['true', 'false'] },
        },
      },
      response: { 200: { type: 'object', description: 'Admin list' } },
    },
  }, listAdminsHandler);

  // GET /admins/:id
  fastify.get('/admins/:id', {
    schema: {
      description: 'Get admin by ID',
      tags: ['admins'],
      params: {
        type: 'object',
        properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
      },
      response: { 200: { type: 'object', description: 'Admin details' } },
    },
  }, getAdminHandler);

  // PATCH /admins/:id
  fastify.patch('/admins/:id', {
    schema: {
      description: 'Update admin',
      tags: ['admins'],
      params: {
        type: 'object',
        properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
      },
      body: {
        type: 'object',
        properties: {
          full_name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          access_level: {
            type: 'string',
            enum: ['SUPER_ADMIN', 'STAFF', 'DEVELOPER'],
          },
          active: { type: 'boolean' },
        },
      },
      response: { 200: { type: 'object', description: 'Admin updated' } },
    },
  }, updateAdminHandler);

  // DELETE /admins/:id (soft delete)
  fastify.delete('/admins/:id', {
    schema: {
      description: 'Deactivate admin',
      tags: ['admins'],
      params: {
        type: 'object',
        properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
      },
      response: { 200: { type: 'object', description: 'Admin deactivated' } },
    },
  }, deleteAdminHandler);
}
