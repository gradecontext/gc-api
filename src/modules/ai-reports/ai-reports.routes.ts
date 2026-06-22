import { Hono } from 'hono';
import { authenticate } from '../../middleware/auth.middleware';
import {
  triggerReportHandler,
  listReportsHandler,
  getReportHandler,
} from './ai-reports.controller';

const aiReports = new Hono();

aiReports.get('/ai-reports', authenticate, listReportsHandler);
aiReports.post('/ai-reports/generate', authenticate, triggerReportHandler);
aiReports.get('/ai-reports/:id', authenticate, getReportHandler);

export { aiReports as aiReportsRoutes };
