/**
 * Decisions Repository
 * Data access layer for decisions
 * 
 * Handles all database operations related to decisions, ensuring immutability
 * (decisions can be updated but never deleted)
 */

import { prisma } from '../../db/client';
import { DecisionType, DecisionStatus, DecisionConfidence } from '@prisma/client';
import { logger } from '../../utils/logger';
import { Prisma } from '@prisma/client';

export interface DecisionCreateData {
  organizationId: string;
  companyId: string;
  dealId?: string;
  decisionType: DecisionType;
  recommendedAction?: string;
  recommendedConfidence?: DecisionConfidence;
  contextSnapshot: {
    signals: unknown;
    policies?: unknown;
    agentRationale?: string;
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
    organizationId: data.organizationId,
    companyId: data.companyId,
    decisionType: data.decisionType,
  });

  return await prisma.decision.create({
    data: {
      organizationId: data.organizationId,
      companyId: data.companyId,
      dealId: data.dealId,
      decisionType: data.decisionType,
      recommendedAction: data.recommendedAction,
      recommendedConfidence: data.recommendedConfidence,
      status: 'PROPOSED',
      contextSnapshot: {
        create: {
          signals: data.contextSnapshot.signals as Prisma.InputJsonValue,
          policies: data.contextSnapshot.policies ? (data.contextSnapshot.policies as Prisma.InputJsonValue) : undefined,
          agentRationale: data.contextSnapshot.agentRationale || null,
        },
      },
    },
    include: {
      contextSnapshot: true,
      company: true,
      deal: true,
    },
  });
}

/**
 * Find decision by ID with all related data
 * Used for audit views and review UI
 */
export async function findDecisionById(
  decisionId: string,
  organizationId?: string
) {
  const where: { id: string; organizationId?: string } = { id: decisionId };
  if (organizationId) {
    where.organizationId = organizationId;
  }

  return await prisma.decision.findFirst({
    where,
    include: {
      contextSnapshot: true,
      company: true,
      deal: true,
      humanOverrides: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
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
          overrideReason,
        },
      });
    }

    return decision;
  });
}

/**
 * Find or create company
 * Ensures company exists before creating decision
 */
export async function findOrCreateCompany(
  organizationId: string,
  companyData: {
    name: string;
    domain?: string;
    industry?: string;
    country?: string;
  }
) {
  // Try to find existing company by domain first, then by name
  if (companyData.domain) {
    const existing = await prisma.company.findFirst({
      where: {
        organizationId,
        domain: companyData.domain,
      },
    });

    if (existing) {
      // Update if new information provided
      if (companyData.industry || companyData.country) {
        return await prisma.company.update({
          where: { id: existing.id },
          data: {
            industry: companyData.industry || existing.industry,
            country: companyData.country || existing.country,
          },
        });
      }
      return existing;
    }
  }

  // Create new company
  return await prisma.company.create({
    data: {
      organizationId,
      name: companyData.name,
      domain: companyData.domain || null,
      industry: companyData.industry || null,
      country: companyData.country || null,
    },
  });
}

/**
 * Find or create deal
 * Creates deal record if deal information provided
 */
export async function findOrCreateDeal(
  companyId: string,
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
        companyId,
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
      companyId,
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
  relationshipType: 'PRECEDENT' | 'SIMILAR_CASE' | 'POLICY_EXCEPTION'
) {
  try {
    return await prisma.decisionLink.create({
      data: {
        fromDecisionId,
        toDecisionId,
        relationshipType,
      },
    });
  } catch (error) {
    // Ignore duplicate link errors
    logger.debug('Decision link may already exist', { fromDecisionId, toDecisionId });
    return null;
  }
}
