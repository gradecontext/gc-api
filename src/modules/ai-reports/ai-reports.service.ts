import OpenAI from 'openai';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { prisma } from '../../db/client';
import {
  createReport,
  updateReport,
  findReportById,
  findReportByIdPublic,
  listReports,
  fetchDecisionsForCategory,
} from './ai-reports.repository';
import {
  AIDecisionReportSummary,
  AIDecisionReportFull,
  TriggerReportInput,
  ListReportsQuery,
} from './ai-reports.types';
import { assertAiReportAllowed } from '../billing/billing.service';

// ── Formatters ────────────────────────────────────────────────

function toSummary(row: NonNullable<Awaited<ReturnType<typeof findReportById>>>): AIDecisionReportSummary {
  return {
    id: row.id,
    client_id: row.clientId,
    category_id: row.categoryId,
    category: row.category.category,
    category_label: row.category.label ?? undefined,
    title: row.title ?? undefined,
    status: row.status,
    decision_count: row.decisionCount ?? undefined,
    agent_model: row.agentModel ?? undefined,
    triggered_by: row.triggeredBy ?? undefined,
    generated_at: row.generatedAt ?? undefined,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

function toFull(row: NonNullable<Awaited<ReturnType<typeof findReportById>>>): AIDecisionReportFull {
  return { ...toSummary(row), content: row.content ?? undefined };
}

// ── Markdown compiler ─────────────────────────────────────────

function compileDecisionMarkdown(
  clientName: string,
  categoryLabel: string,
  decisions: Awaited<ReturnType<typeof fetchDecisionsForCategory>>
): string {
  const now = new Date().toISOString().split('T')[0];
  const total = decisions.length;
  const approved = decisions.filter((d) => d.status === 'APPROVED').length;
  const rejected = decisions.filter((d) => d.status === 'REJECTED').length;
  const escalated = decisions.filter((d) => d.status === 'ESCALATED').length;
  const pending = total - approved - rejected - escalated;

  const lines: string[] = [
    `# ${categoryLabel} — Context`,
    `**Organisation:** ${clientName}`,
    `**Category:** ${categoryLabel}`,
    `**Generated:** ${now}`,
    `**Total decisions:** ${total} | Approved: ${approved} | Rejected: ${rejected} | Escalated: ${escalated} | Pending: ${pending}`,
    '',
    '---',
    '',
  ];

  decisions.forEach((d, i) => {
    const date = d.createdAt.toISOString().split('T')[0];
    const decisionType = d.clientDecisionType?.label || d.clientDecisionType?.decisionType || 'CUSTOM';
    const subject = d.subjectCompany?.name ?? 'Unknown';
    const decidedBy = d.decisionMaker?.name ?? 'Not yet decided';

    lines.push(`## ${i + 1}. ${d.summary ?? 'Untitled decision'}`);
    lines.push(`**Date:** ${date} | **Type:** ${decisionType} | **Status:** ${d.status} | **Decided by:** ${decidedBy}`);
    lines.push(`**Subject:** ${subject}`);
    lines.push('');

    if (d.notes.length > 0) {
      lines.push('**Notes:**');
      d.notes.forEach((n) => {
        const src = n.sourceApp ? ` *(via ${n.sourceApp})*` : '';
        lines.push(`> ${n.content}${src}`);
      });
      lines.push('');
    }

    if (d.humanOverrides.length > 0) {
      lines.push('**Overrides:**');
      d.humanOverrides.forEach((o) => {
        const who = o.user?.name ?? `User #${o.userId}`;
        const reason = o.overrideReason ? ` — "${o.overrideReason}"` : '';
        lines.push(`- ${o.overrideAction} by ${who}${reason}`);
      });
      lines.push('');
    }

    if (d.outcomes.length > 0) {
      lines.push('**Outcomes:**');
      d.outcomes.forEach((o) => {
        lines.push(`- ${o.outcomeType}${o.notes ? `: ${o.notes}` : ''}`);
      });
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}

// ── Optional AI analysis layer ────────────────────────────────

async function enrichWithAI(
  markdown: string,
  categoryLabel: string,
  decisionCount: number
): Promise<{ enriched: string; model: string } | null> {
  if (!env.OPENAI_API_KEY) return null;

  try {
    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an organisational memory analyst. You receive a raw decision log in Markdown and append a concise "## AI Insights" section at the end.
- Identify recurring patterns, themes, or risks across the decisions
- Highlight decisions that set useful precedent
- Note any contradictory or escalated decisions that deserve attention
- Keep your analysis under 300 words
- Do NOT rewrite or alter the existing log — only append the insights section`,
        },
        {
          role: 'user',
          content: `Category: ${categoryLabel}\nTotal decisions: ${decisionCount}\n\n${markdown}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 600,
    });

    const insight = response.choices[0]?.message?.content;
    if (!insight) return null;

    return {
      enriched: `${markdown}\n${insight}`,
      model: 'gpt-4o-mini',
    };
  } catch (err) {
    logger.warn('AI enrichment failed, returning raw markdown', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ── Public service functions ──────────────────────────────────

export async function triggerReport(
  clientId: number,
  input: TriggerReportInput,
  userId?: number
): Promise<AIDecisionReportFull> {
  // Verify category belongs to client
  const category = await prisma.clientContextCategory.findFirst({
    where: { id: input.category_id, clientId },
  });
  if (!category) throw new Error('Context category not found for this client');

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true },
  });
  if (!client) throw new Error('Client not found');

  await assertAiReportAllowed(clientId);

  // Create report row immediately (status = GENERATING)
  const report = await createReport({ clientId, categoryId: category.id, triggeredBy: userId });

  try {
    const decisions = await fetchDecisionsForCategory(clientId, category.id);
    const categoryLabel = category.label || category.category;

    let content = compileDecisionMarkdown(client.name, categoryLabel, decisions);
    let agentModel: string | undefined;

    const enriched = await enrichWithAI(content, categoryLabel, decisions.length);
    if (enriched) {
      content = enriched.enriched;
      agentModel = enriched.model;
    }

    const title = `${categoryLabel} — Context (${new Date().toISOString().split('T')[0]})`;

    await updateReport(report.id, {
      status: 'COMPLETED',
      content,
      title,
      decisionCount: decisions.length,
      agentModel,
      generatedAt: new Date(),
    });
  } catch (err) {
    await updateReport(report.id, { status: 'FAILED' });
    throw err;
  }

  const updated = await findReportById(report.id, clientId);
  if (!updated) throw new Error('Failed to fetch generated report');
  return toFull(updated);
}

export async function getReport(id: string, clientId: number): Promise<AIDecisionReportFull | null> {
  const row = await findReportById(id, clientId);
  return row ? toFull(row) : null;
}

// Public share-link lookup: the report id (a UUID) is the only credential, so this
// intentionally skips client scoping. Only COMPLETED reports are exposed — anything
// still GENERATING/FAILED/PENDING has no finished content worth sharing.
export async function getPublicReport(id: string): Promise<AIDecisionReportFull | null> {
  const row = await findReportByIdPublic(id);
  if (!row || row.status !== 'COMPLETED') return null;
  return toFull(row);
}

export async function getReports(
  clientId: number,
  query: ListReportsQuery
): Promise<AIDecisionReportSummary[]> {
  const rows = await listReports(clientId, {
    categoryId: query.category_id,
    status: query.status,
  });
  return rows.map(toSummary);
}
