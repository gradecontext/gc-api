/**
 * MCP (Model Context Protocol) server — exposes compiled AI Decision Reports
 * to MCP clients (Claude Desktop, Claude Code, etc.) as tools, so an LLM can
 * pull decision context directly instead of a human copy-pasting decision.md.
 *
 * Read-only by design: no tool here can trigger report generation or touch
 * raw decisions. Report generation stays an explicit dashboard/API action
 * (and, eventually, the cron job) — never something an MCP client can invoke
 * mid-conversation.
 *
 * Every tool closes over a single `clientId` captured at server construction
 * time (see mcp.routes.ts) and passes it into the same clientId-scoped
 * service functions the REST API uses (getContextCategories/getReports/
 * getReport). There is no code path in this file that can query another
 * client's data — the tools simply don't accept a client identifier as
 * input.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getContextCategories } from '../decisions/decisions.service';
import { getReports, getReport } from '../ai-reports/ai-reports.service';

const REPORT_STATUS_VALUES = ['PENDING', 'GENERATING', 'COMPLETED', 'FAILED'] as const;

export function createMcpServer(clientId: number): McpServer {
  const server = new McpServer({
    name: 'contextgrade',
    version: '0.1.0',
  });

  server.registerTool(
    'list_context_categories',
    {
      title: 'List context categories',
      description:
        'List this client\'s context categories (reserved + custom), e.g. PAYMENT, ONBOARDING, SALES. ' +
        'Use the returned "category" value as the category_id filter for list_ai_reports.',
      inputSchema: {},
    },
    async () => {
      const categories = await getContextCategories(clientId);
      return {
        content: [{ type: 'text', text: JSON.stringify({ categories }, null, 2) }],
      };
    },
  );

  server.registerTool(
    'list_ai_reports',
    {
      title: 'List AI Decision Reports',
      description:
        'List this client\'s compiled AI Decision Reports (metadata only — no markdown content). ' +
        'Optionally filter by category_id (a context category id from list_context_categories) or status. ' +
        'Use get_ai_report with a report\'s id to fetch its full content.',
      inputSchema: {
        category_id: z
          .string()
          .uuid()
          .optional()
          .describe('Filter to reports for this context category id (UUID).'),
        status: z
          .enum(REPORT_STATUS_VALUES)
          .optional()
          .describe('Filter by report status. Only COMPLETED reports have readable content.'),
      },
    },
    async ({ category_id, status }) => {
      const reports = await getReports(clientId, { category_id, status });
      return {
        content: [{ type: 'text', text: JSON.stringify({ reports }, null, 2) }],
      };
    },
  );

  server.registerTool(
    'get_ai_report',
    {
      title: 'Get AI Decision Report',
      description:
        'Fetch one compiled AI Decision Report by id, including its full decision.md-style markdown content. ' +
        'Only returns reports belonging to the authenticated client.',
      inputSchema: {
        report_id: z.string().uuid().describe('The report id, from list_ai_reports.'),
      },
    },
    async ({ report_id }) => {
      const report = await getReport(report_id, clientId);

      if (!report) {
        return {
          content: [{ type: 'text', text: `No report found with id ${report_id} for this client.` }],
          isError: true,
        };
      }

      if (report.status !== 'COMPLETED' || !report.content) {
        return {
          content: [
            {
              type: 'text',
              text: `Report ${report_id} has no content yet (status: ${report.status}).`,
            },
          ],
        };
      }

      return {
        content: [{ type: 'text', text: report.content }],
      };
    },
  );

  return server;
}
