import { Context } from 'hono';
import { z } from 'zod';
import { logger } from '../../utils/logger';
import { triggerReport, getReport, getReports } from './ai-reports.service';

const triggerSchema = z.object({
  category_id: z.string().uuid(),
});

export async function triggerReportHandler(c: Context) {
  try {
    const clientId = c.get('clientId') as number | undefined;
    if (!clientId) {
      return c.json({ error: 'Bad Request', message: 'Client context required.' }, 400);
    }

    const userId = c.get('userId') as number | undefined;
    const body = triggerSchema.parse(await c.req.json());

    const report = await triggerReport(clientId, body, userId);
    return c.json(report, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation Error', message: 'Invalid request body', details: error.errors }, 400);
    }
    if (error instanceof Error && error.message === 'Context category not found for this client') {
      return c.json({ error: 'Not Found', message: error.message }, 404);
    }
    logger.error('Error triggering AI report', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function listReportsHandler(c: Context) {
  try {
    const clientId = c.get('clientId') as number | undefined;
    if (!clientId) {
      return c.json({ error: 'Bad Request', message: 'Client context required.' }, 400);
    }

    const category_id = c.req.query('category_id');
    const status = c.req.query('status') as string | undefined;

    const reports = await getReports(clientId, {
      category_id,
      status: status as Parameters<typeof getReports>[1]['status'],
    });

    return c.json({ data: reports }, 200);
  } catch (error) {
    logger.error('Error listing AI reports', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function getReportHandler(c: Context) {
  try {
    const clientId = c.get('clientId') as number | undefined;
    if (!clientId) {
      return c.json({ error: 'Bad Request', message: 'Client context required.' }, 400);
    }

    const id = c.req.param('id');
    const report = await getReport(id, clientId);

    if (!report) {
      return c.json({ error: 'Not Found', message: 'Report not found' }, 404);
    }

    return c.json(report, 200);
  } catch (error) {
    logger.error('Error fetching AI report', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
