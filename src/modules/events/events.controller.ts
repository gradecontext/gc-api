import { Context } from 'hono';
import { z } from 'zod';
import { logger } from '../../utils/logger';
import { logObservedEvent } from './events.service';

const createObservedEventSchema = z.object({
  client_id: z.number().int().positive().optional(),
  source_app: z.string().min(1),
  event_type: z.string().min(1),
  source_url: z.string().optional(),
  external_entity_id: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  raw_payload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  occurred_at: z.string().datetime({ offset: true }).optional(),
  converted_to_decision_id: z.string().uuid().optional(),
});

export async function createObservedEventHandler(c: Context) {
  try {
    const body = createObservedEventSchema.parse(await c.req.json());

    const resolvedClientId = c.get('clientId') ?? body.client_id;
    if (!resolvedClientId) {
      return c.json(
        { error: 'Bad Request', message: 'client_id is required when not using an API key or multi-membership session.' },
        400
      );
    }

    const userId = c.get('userId') as number | undefined;

    logger.info('Observed event received', {
      clientId: resolvedClientId,
      sourceApp: body.source_app,
      eventType: body.event_type,
    });

    const event = await logObservedEvent(body, resolvedClientId, userId);

    return c.json(event, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation Error', message: 'Invalid request body', details: error.errors }, 400);
    }
    if (error instanceof Error && error.message === 'Client not found') {
      return c.json({ error: 'Not Found', message: 'Client not found' }, 404);
    }
    if (error instanceof Error && error.message === 'Client account is inactive') {
      return c.json({ error: 'Forbidden', message: 'Client account is inactive' }, 403);
    }
    logger.error('Error creating observed event', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
