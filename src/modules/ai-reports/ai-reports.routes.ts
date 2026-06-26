import { Hono } from 'hono';
import { authenticate } from '../../middleware/auth.middleware';
import {
  triggerReportHandler,
  listReportsHandler,
  getReportHandler,
  getPublicReportHandler,
} from './ai-reports.controller';

const aiReports = new Hono();

aiReports.get('/ai-reports', authenticate, listReportsHandler);
aiReports.post('/ai-reports/generate', authenticate, triggerReportHandler);
// Public share link — no auth. Must be registered before "/ai-reports/:id" so the
// literal "public" segment isn't swallowed as a sibling :id route ambiguity.
aiReports.get('/ai-reports/:id/public', getPublicReportHandler);
aiReports.get('/ai-reports/:id', authenticate, getReportHandler);

export { aiReports as aiReportsRoutes };
