/**
 * Users Routes
 * Fastify route definitions for user endpoints
 *
 * All user routes require Supabase session authentication.
 */

import { FastifyInstance } from 'fastify';
import {
  createUserHandler,
  getMeHandler,
  getUserHandler,
  updateUserHandler,
} from './users.controller';
import { sessionAuth } from '../../middleware/session.middleware';

export async function usersRoutes(fastify: FastifyInstance) {
  // All user routes require Supabase session authentication
  fastify.addHook('onRequest', sessionAuth(true));

  // POST /users - Create user (requires Supabase auth)
  fastify.post('/users', {
    schema: {
      description:
        'Create a new user linked to Supabase auth with client association',
      tags: ['users'],
      body: {
        type: 'object',
        required: ['client', 'email'],
        properties: {
          client: {
            type: 'object',
            description:
              'Client/company association. Either client_id or client_name is required.',
            properties: {
              client_id: {
                type: 'integer',
                description: 'Existing client ID to attach to',
              },
              client_name: {
                type: 'string',
                description:
                  'Company name to find-or-create (used when client_id is absent)',
              },
              plan: {
                type: 'string',
                enum: ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
                description: 'Defaults to STARTER if not provided',
              },
              details: { type: 'string' },
              logo: { type: 'string' },
              cover_image: { type: 'string' },
              client_website: { type: 'string' },
              client_x: { type: 'string' },
              client_linkedin: { type: 'string' },
              client_instagram: { type: 'string' },
              settings: { type: 'object' },
            },
          },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          title: { type: 'string' },
          role: {
            type: 'string',
            enum: ['OWNER', 'ADMIN', 'APPROVER', 'VIEWER'],
          },
          display_name: { type: 'string', maxLength: 150 },
          user_name: { type: 'string', maxLength: 100 },
          image_url: { type: 'string', format: 'uri' },
          user_image: { type: 'string' },
          user_image_cover: { type: 'string' },
          user_bio_detail: { type: 'string' },
          user_bio_brief: { type: 'string', maxLength: 255 },
          gender: {
            type: 'string',
            enum: [
              'MALE', 'FEMALE', 'NON_BINARY', 'GENDERQUEER', 'GENDERFLUID',
              'AGENDER', 'BIGENDER', 'TWO_SPIRIT', 'TRANSGENDER_MALE',
              'TRANSGENDER_FEMALE', 'INTERSEX', 'PREFER_NOT_TO_SAY', 'OTHER',
            ],
          },
        },
      },
      response: {
        201: {
          type: 'object',
          description: 'User created successfully with client association',
        },
      },
    },
  }, createUserHandler);

  // GET /users/me - Get current authenticated user's profile
  fastify.get('/users/me', {
    schema: {
      description: 'Get the current authenticated user profile',
      tags: ['users'],
      response: {
        200: { type: 'object', description: 'User profile' },
      },
    },
  }, getMeHandler);

  // GET /users/:id - Get user by ID
  fastify.get('/users/:id', {
    schema: {
      description: 'Get user by internal ID',
      tags: ['users'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$' },
        },
      },
    },
  }, getUserHandler);

  // PATCH /users/:id - Update user profile
  fastify.patch('/users/:id', {
    schema: {
      description: 'Update user profile (owner only)',
      tags: ['users'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$' },
        },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          title: { type: 'string' },
          display_name: { type: 'string', maxLength: 150 },
          user_name: { type: 'string', maxLength: 100 },
          image_url: { type: 'string', format: 'uri' },
          user_image: { type: 'string' },
          user_image_cover: { type: 'string' },
          user_bio_detail: { type: 'string' },
          user_bio_brief: { type: 'string', maxLength: 255 },
          gender: {
            type: ['string', 'null'],
            enum: [
              'MALE', 'FEMALE', 'NON_BINARY', 'GENDERQUEER', 'GENDERFLUID',
              'AGENDER', 'BIGENDER', 'TWO_SPIRIT', 'TRANSGENDER_MALE',
              'TRANSGENDER_FEMALE', 'INTERSEX', 'PREFER_NOT_TO_SAY', 'OTHER',
              null,
            ],
          },
        },
      },
    },
  }, updateUserHandler);
}
