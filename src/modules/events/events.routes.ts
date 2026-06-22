import { Hono } from 'hono';
import { createObservedEventHandler } from './events.controller';
import { authenticate } from '../../middleware/auth.middleware';

const events = new Hono();

events.post('/events', authenticate, createObservedEventHandler);

export { events as eventsRoutes };
