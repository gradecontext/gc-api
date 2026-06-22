import { prisma } from '../../db/client';
import { AIReportStatus, Prisma } from '@prisma/client';

export async function createReport(data: {
  clientId: number;
  categoryId: string;
  triggeredBy?: number;
}) {
  return await prisma.aIDecisionReport.create({
    data: {
      clientId: data.clientId,
      categoryId: data.categoryId,
      triggeredBy: data.triggeredBy ?? null,
      status: 'GENERATING',
    },
    include: { category: { select: { category: true, label: true } } },
  });
}

export async function updateReport(id: string, data: {
  status: AIReportStatus;
  content?: string;
  title?: string;
  decisionCount?: number;
  agentModel?: string;
  generatedAt?: Date;
}) {
  return await prisma.aIDecisionReport.update({
    where: { id },
    data: {
      status: data.status,
      content: data.content ?? undefined,
      title: data.title ?? undefined,
      decisionCount: data.decisionCount ?? undefined,
      agentModel: data.agentModel ?? undefined,
      generatedAt: data.generatedAt ?? undefined,
    },
  });
}

export async function findReportById(id: string, clientId: number) {
  return await prisma.aIDecisionReport.findFirst({
    where: { id, clientId },
    include: { category: { select: { category: true, label: true } } },
  });
}

export async function listReports(clientId: number, filters: {
  categoryId?: string;
  status?: AIReportStatus;
}) {
  const where: Prisma.AIDecisionReportWhereInput = { clientId };
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.status) where.status = filters.status;

  return await prisma.aIDecisionReport.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { category: { select: { category: true, label: true } } },
  });
}

// Fetch all decisions (with notes and overrides) for a given client + context category.
// Used by the AI report generator to compile the decision.md.
export async function fetchDecisionsForCategory(clientId: number, categoryId: string) {
  return await prisma.decision.findMany({
    where: {
      clientId,
      context: { categoryId },
    },
    orderBy: { createdAt: 'asc' },
    include: {
      clientDecisionType: { select: { decisionType: true, label: true } },
      subjectCompany: { select: { name: true, domain: true, industry: true, country: true } },
      context: { select: { key: true, name: true } },
      notes: { orderBy: { createdAt: 'asc' } },
      humanOverrides: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      },
      outcomes: { orderBy: { recordedAt: 'asc' } },
      decisionMaker: { select: { name: true } },
    },
  });
}
