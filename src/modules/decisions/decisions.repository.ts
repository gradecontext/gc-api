/**
 * Decisions Repository
 * Data access layer for decisions
 * 
 * Handles all database operations related to decisions, ensuring immutability
 * (decisions can be updated but never deleted)
 */

import { prisma } from '../../db/client';
import { DecisionType, DecisionStatus, DecisionConfidence, RelationshipType } from '@prisma/client';
import { logger } from '../../utils/logger';
import { Prisma } from '@prisma/client';

export interface DecisionCreateData {
  tenantId: string;
  subjectCompanyId: string;
  dealId?: string;
  contextId?: string;
  decisionType: DecisionType;
  recommendedAction?: string;
  recommendedConfidence?: DecisionConfidence;
  suggestedConditions?: unknown;
  contextSnapshot: {
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
  decidedBy?: string;
  decidedAt: Date;
}

/**
 * Create a new decision with context snapshot
 * This is the main entry point for decision creation
 */
export async function createDecision(data: DecisionCreateData) {
  logger.debug('Creating decision', {
    tenantId: data.tenantId,
    subjectCompanyId: data.subjectCompanyId,
    decisionType: data.decisionType,
  });

  return await prisma.decision.create({
    data: {
      tenantId: data.tenantId,
      subjectCompanyId: data.subjectCompanyId,
      dealId: data.dealId,
      contextId: data.contextId,
      decisionType: data.decisionType,
      recommendedAction: data.recommendedAction,
      recommendedConfidence: data.recommendedConfidence,
      suggestedConditions: data.suggestedConditions ? (data.suggestedConditions as Prisma.InputJsonValue) : undefined,
      status: 'PROPOSED',
      contextSnapshot: {
        create: {
          signals: data.contextSnapshot.signals as Prisma.InputJsonValue,
          policies: data.contextSnapshot.policies ? (data.contextSnapshot.policies as Prisma.InputJsonValue) : undefined,
          agentRationale: data.contextSnapshot.agentRationale || null,
          agentModel: data.contextSnapshot.agentModel || null,
          processingTimeMs: data.contextSnapshot.processingTimeMs || null,
        },
      },
    },
    include: {
      contextSnapshot: true,
      subjectCompany: true,
      deal: true,
      context: true,
    },
  });
}

/**
 * Find decision by ID with all related data
 * Used for audit views and review UI
 */
export async function findDecisionById(
  decisionId: string,
  tenantId?: string
) {
  const where: { id: string; tenantId?: string } = { id: decisionId };
  if (tenantId) {
    where.tenantId = tenantId;
  }

  return await prisma.decision.findFirst({
    where,
    include: {
      contextSnapshot: true,
      subjectCompany: true,
      deal: true,
      context: true,
      humanOverrides: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
      linksAsSource: {
        include: {
          targetDecision: {
            select: {
              id: true,
              decisionType: true,
              status: true,
              createdAt: true,
            },
          },
        },
      },
      externalSources: true,
    },
  });
}

/**
 * Update decision status (for human review)
 * Records override if status is OVERRIDDEN
 */
export async function updateDecisionStatus(
  decisionId: string,
  data: DecisionUpdateData,
  overrideReason?: string,
  overrideUserId?: string
) {
  logger.debug('Updating decision status', {
    decisionId,
    status: data.status,
  });

  // Start transaction to ensure atomicity
  return await prisma.$transaction(async (tx) => {
    // Update decision
    const decision = await tx.decision.update({
      where: { id: decisionId },
      data: {
        status: data.status,
        finalAction: data.finalAction,
        decidedBy: data.decidedBy,
        decidedAt: data.decidedAt,
      },
    });

    // Record override if applicable
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

/**
 * Find or create subject company
 * Uses externalId for idempotent upsert within a tenant
 */
export async function findOrCreateSubjectCompany(
  tenantId: string,
  companyData: {
    externalId: string;
    name: string;
    domain?: string;
    industry?: string;
    country?: string;
    metadata?: unknown;
  }
) {
  // Upsert by tenantId + externalId (the unique constraint)
  return await prisma.subjectCompany.upsert({
    where: {
      tenantId_externalId: {
        tenantId,
        externalId: companyData.externalId,
      },
    },
    update: {
      name: companyData.name,
      domain: companyData.domain || undefined,
      industry: companyData.industry || undefined,
      country: companyData.country || undefined,
      metadata: companyData.metadata ? (companyData.metadata as Prisma.InputJsonValue) : undefined,
    },
    create: {
      tenantId,
      externalId: companyData.externalId,
      name: companyData.name,
      domain: companyData.domain || null,
      industry: companyData.industry || null,
      country: companyData.country || null,
      metadata: companyData.metadata ? (companyData.metadata as Prisma.InputJsonValue) : undefined,
    },
  });
}

/**
 * Find or create deal
 * Creates deal record if deal information provided
 */
export async function findOrCreateDeal(
  subjectCompanyId: string,
  dealData?: {
    crm_deal_id?: string;
    amount?: number;
    currency?: string;
    discount_requested?: number;
  }
) {
  if (!dealData) {
    return null;
  }

  // If CRM deal ID provided, try to find existing
  if (dealData.crm_deal_id) {
    const existing = await prisma.deal.findFirst({
      where: {
        subjectCompanyId,
        crmDealId: dealData.crm_deal_id,
      },
    });

    if (existing) {
      return existing;
    }
  }

  // Create new deal
  return await prisma.deal.create({
    data: {
      subjectCompanyId,
      crmDealId: dealData.crm_deal_id || null,
      amount: dealData.amount ? dealData.amount : null,
      currency: dealData.currency || null,
      discountRequested: dealData.discount_requested
        ? dealData.discount_requested
        : null,
    },
  });
}

/**
 * Link two decisions (for precedent tracking)
 */
export async function linkDecisions(
  fromDecisionId: string,
  toDecisionId: string,
  relationshipType: RelationshipType,
  confidence?: number,
  notes?: string
) {
  try {
    return await prisma.decisionLink.create({
      data: {
        fromDecisionId,
        toDecisionId,
        relationshipType,
        confidence: confidence ?? null,
        notes: notes ?? null,
      },
    });
  } catch (error) {
    // Ignore duplicate link errors
    logger.debug('Decision link may already exist', { fromDecisionId, toDecisionId });
    return null;
  }
}
