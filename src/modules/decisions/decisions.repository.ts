import { prisma } from '../../db/client';
import { DecisionStatus, DecisionConfidence, RelationshipType, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';

export interface DecisionCreateData {
  clientId: number;
  subjectCompanyId: number;
  dealId?: string;
  contextId?: string;
  decisionTypeId: string; // FK to client_decision_types
  summary?: string;
  loggedBy?: number; // who captured this decision (extension/API caller)
  recommendedAction?: string;
  recommendedConfidence?: DecisionConfidence;
  suggestedConditions?: unknown;
  // contextSnapshot is no longer created on every decision — AI reports are triggered separately
  contextSnapshot?: {
    signals: unknown;
    policies?: unknown;
    agentRationale?: string;
    agentModel?: string;
    processingTimeMs?: number;
  };
}

export interface DecisionUpdateData {
  status: DecisionStatus;
  finalAction?: string;
  decidedBy?: number;
  decidedAt: Date;
}

export async function createDecision(data: DecisionCreateData) {
  logger.debug('Creating decision', {
    clientId: data.clientId,
    subjectCompanyId: data.subjectCompanyId,
    decisionTypeId: data.decisionTypeId,
  });

  return await prisma.decision.create({
    data: {
      clientId: data.clientId,
      subjectCompanyId: data.subjectCompanyId,
      dealId: data.dealId,
      contextId: data.contextId,
      decisionTypeId: data.decisionTypeId,
      summary: data.summary,
      loggedBy: data.loggedBy,
      recommendedAction: data.recommendedAction,
      recommendedConfidence: data.recommendedConfidence,
      suggestedConditions: data.suggestedConditions ? (data.suggestedConditions as Prisma.InputJsonValue) : undefined,
      status: 'PROPOSED',
      ...(data.contextSnapshot && {
        contextSnapshot: {
          create: {
            signals: data.contextSnapshot.signals as Prisma.InputJsonValue,
            policies: data.contextSnapshot.policies ? (data.contextSnapshot.policies as Prisma.InputJsonValue) : undefined,
            agentRationale: data.contextSnapshot.agentRationale || null,
            agentModel: data.contextSnapshot.agentModel || null,
            processingTimeMs: data.contextSnapshot.processingTimeMs || null,
          },
        },
      }),
    },
    include: {
      contextSnapshot: true,
      subjectCompany: true,
      deal: true,
      context: true,
      clientDecisionType: { select: { decisionType: true, label: true } },
    },
  });
}

export async function findDecisionById(decisionId: string, clientId?: number) {
  const where: { id: string; clientId?: number } = { id: decisionId };
  if (clientId) where.clientId = clientId;

  return await prisma.decision.findFirst({
    where,
    include: {
      contextSnapshot: true,
      subjectCompany: true,
      deal: true,
      context: {
        include: { clientContextCategory: { select: { category: true } } },
      },
      clientDecisionType: { select: { decisionType: true, label: true } },
      decisionMaker: {
        select: { id: true, name: true, title: true, email: true },
      },
      loggedByUser: {
        select: { id: true, name: true, title: true, email: true },
      },
      notes: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      },
      humanOverrides: {
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { id: true, email: true, name: true, title: true } },
        },
      },
      linksAsSource: {
        include: {
          targetDecision: {
            select: {
              id: true,
              status: true,
              summary: true,
              createdAt: true,
              clientDecisionType: { select: { decisionType: true } },
            },
          },
        },
      },
      externalSources: true,
    },
  });
}

export async function updateDecisionStatus(
  decisionId: string,
  data: DecisionUpdateData,
  overrideReason?: string,
  overrideUserId?: number
) {
  logger.debug('Updating decision status', { decisionId, status: data.status });

  return await prisma.$transaction(async (tx) => {
    const decision = await tx.decision.update({
      where: { id: decisionId },
      data: {
        status: data.status,
        finalAction: data.finalAction,
        decidedBy: data.decidedBy,
        decidedAt: data.decidedAt,
      },
    });

    if (data.status === 'OVERRIDDEN' && overrideUserId && overrideReason) {
      await tx.decisionHumanOverride.create({
        data: {
          decisionId,
          userId: overrideUserId,
          overrideAction: 'MODIFIED',
          overrideReason,
        },
      });
    }

    return decision;
  });
}

export async function findOrCreateSubjectCompany(
  clientId: number,
  companyData: {
    externalId: string;
    name: string;
    domain?: string;
    industry?: string;
    country?: string;
    metadata?: unknown;
  }
) {
  return await prisma.subjectCompany.upsert({
    where: { clientId_externalId: { clientId, externalId: companyData.externalId } },
    update: {
      name: companyData.name,
      domain: companyData.domain || undefined,
      industry: companyData.industry || undefined,
      country: companyData.country || undefined,
      metadata: companyData.metadata ? (companyData.metadata as Prisma.InputJsonValue) : undefined,
      active: true,
    },
    create: {
      clientId,
      externalId: companyData.externalId,
      name: companyData.name,
      domain: companyData.domain || null,
      industry: companyData.industry || null,
      country: companyData.country || null,
      metadata: companyData.metadata ? (companyData.metadata as Prisma.InputJsonValue) : undefined,
    },
  });
}

export async function findActiveSubjectCompany(clientId: number, externalId: string) {
  return await prisma.subjectCompany.findFirst({
    where: { clientId, externalId, active: true },
  });
}

export async function findOrCreateDeal(
  subjectCompanyId: number,
  dealData?: {
    crm_deal_id?: string;
    amount?: number;
    currency?: string;
    discount_requested?: number;
  }
) {
  if (!dealData) return null;

  if (dealData.crm_deal_id) {
    const existing = await prisma.deal.findFirst({
      where: { subjectCompanyId, crmDealId: dealData.crm_deal_id },
    });
    if (existing) return existing;
  }

  return await prisma.deal.create({
    data: {
      subjectCompanyId,
      crmDealId: dealData.crm_deal_id || null,
      amount: dealData.amount ? dealData.amount : null,
      currency: dealData.currency || null,
      discountRequested: dealData.discount_requested ? dealData.discount_requested : null,
    },
  });
}

export async function listDecisions(params: {
  clientId: number;
  status?: string;
  decisionType?: string;
  loggedBy?: number;
  decidedBy?: number;
  page: number;
  limit: number;
}) {
  const where: Prisma.DecisionWhereInput = { clientId: params.clientId };

  if (params.status) {
    where.status = params.status as DecisionStatus;
  }
  if (params.decisionType) {
    where.clientDecisionType = { decisionType: params.decisionType };
  }
  if (params.loggedBy) {
    where.loggedBy = params.loggedBy;
  }
  if (params.decidedBy) {
    where.decidedBy = params.decidedBy;
  }

  const skip = (params.page - 1) * params.limit;

  const [decisions, total] = await Promise.all([
    prisma.decision.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: params.limit,
      include: {
        subjectCompany: { select: { id: true, name: true, domain: true } },
        clientDecisionType: { select: { decisionType: true } },
        loggedByUser: { select: { id: true, name: true } },
      },
    }),
    prisma.decision.count({ where }),
  ]);

  return { decisions, total };
}

export async function findDecisionContextByKey(clientId: number, key: string) {
  return await prisma.decisionContext.findUnique({
    where: { clientId_key: { clientId, key } },
  });
}

export async function listDecisionContexts(clientId: number) {
  const contexts = await prisma.decisionContext.findMany({
    where: { clientId, active: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      active: true,
      clientContextCategory: { select: { category: true } },
    },
  });

  return contexts.map((c) => ({
    id: c.id,
    key: c.key,
    name: c.name,
    description: c.description ?? undefined,
    category: c.clientContextCategory.category,
    active: c.active,
  }));
}

export async function addDecisionNote(data: {
  decisionId: string;
  authorId?: number;
  content: string;
  sourceApp?: string;
  sourceUrl?: string;
}) {
  return await prisma.decisionNote.create({
    data: {
      decisionId: data.decisionId,
      authorId: data.authorId ?? null,
      content: data.content,
      sourceApp: data.sourceApp ?? null,
      sourceUrl: data.sourceUrl ?? null,
    },
  });
}

export async function linkDecisions(
  fromDecisionId: string,
  toDecisionId: string,
  relationshipType: RelationshipType,
  confidence?: number,
  notes?: string
) {
  try {
    return await prisma.decisionLink.create({
      data: { fromDecisionId, toDecisionId, relationshipType, confidence: confidence ?? null, notes: notes ?? null },
    });
  } catch {
    logger.debug('Decision link may already exist', { fromDecisionId, toDecisionId });
    return null;
  }
}

// ============================================================
// CLIENT DECISION TYPE CRUD
// ============================================================

export async function findClientDecisionTypeByValue(clientId: number, decisionType: string) {
  return await prisma.clientDecisionType.findUnique({
    where: { clientId_decisionType: { clientId, decisionType } },
  });
}

export async function listClientDecisionTypes(clientId: number) {
  return await prisma.clientDecisionType.findMany({
    where: { clientId },
    orderBy: [{ isReserved: 'desc' }, { decisionType: 'asc' }],
  });
}

export async function createClientDecisionType(clientId: number, data: {
  decisionType: string;
  label?: string;
}) {
  return await prisma.clientDecisionType.create({
    data: {
      clientId,
      decisionType: data.decisionType.toUpperCase().replace(/\s+/g, '_'),
      label: data.label ?? null,
      isReserved: false,
    },
  });
}

export async function updateClientDecisionType(id: string, data: {
  decisionType?: string;
  label?: string;
  active?: boolean;
}) {
  return await prisma.clientDecisionType.update({
    where: { id },
    data: {
      ...(data.decisionType !== undefined && {
        decisionType: data.decisionType.toUpperCase().replace(/\s+/g, '_'),
      }),
      ...(data.label !== undefined && { label: data.label }),
      ...(data.active !== undefined && { active: data.active }),
    },
  });
}

export async function deleteClientDecisionType(id: string) {
  return await prisma.clientDecisionType.delete({ where: { id } });
}

export async function findClientDecisionTypeById(id: string, clientId: number) {
  return await prisma.clientDecisionType.findFirst({ where: { id, clientId } });
}

// ============================================================
// CLIENT CONTEXT CATEGORY CRUD
// ============================================================

export async function findClientContextCategoryByValue(clientId: number, category: string) {
  return await prisma.clientContextCategory.findUnique({
    where: { clientId_category: { clientId, category } },
  });
}

export async function listClientContextCategories(clientId: number) {
  return await prisma.clientContextCategory.findMany({
    where: { clientId },
    orderBy: [{ isReserved: 'desc' }, { category: 'asc' }],
  });
}

export async function createClientContextCategory(clientId: number, data: {
  category: string;
  label?: string;
}) {
  return await prisma.clientContextCategory.create({
    data: {
      clientId,
      category: data.category.toUpperCase().replace(/\s+/g, '_'),
      label: data.label ?? null,
      isReserved: false,
    },
  });
}

export async function updateClientContextCategory(id: string, data: {
  category?: string;
  label?: string;
  active?: boolean;
}) {
  return await prisma.clientContextCategory.update({
    where: { id },
    data: {
      ...(data.category !== undefined && {
        category: data.category.toUpperCase().replace(/\s+/g, '_'),
      }),
      ...(data.label !== undefined && { label: data.label }),
      ...(data.active !== undefined && { active: data.active }),
    },
  });
}

export async function deleteClientContextCategory(id: string) {
  return await prisma.clientContextCategory.delete({ where: { id } });
}

export async function findClientContextCategoryById(id: string, clientId: number) {
  return await prisma.clientContextCategory.findFirst({ where: { id, clientId } });
}
