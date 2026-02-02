/**
 * Decisions Service
 * Business logic layer for decisions
 * 
 * Orchestrates:
 * 1. Context gathering
 * 2. AI recommendation generation
 * 3. Decision persistence
 * 4. Status updates
 */

import { logger } from '../../utils/logger';
import { gatherContext } from '../context/context.service';
import { generateDecisionRecommendation } from '../agents/decisionProposal.agent';
import {
  createDecision,
  findDecisionById,
  updateDecisionStatus,
  findOrCreateCompany,
  findOrCreateDeal,
  DecisionCreateData,
  DecisionUpdateData,
} from './decisions.repository';
import { CreateDecisionInput, ReviewDecisionInput, DecisionResponse } from './decisions.types';
import { DecisionStatus, DecisionConfidence } from '@prisma/client';

/**
 * Process a new decision request
 * 
 * This is the main orchestration function:
 * 1. Creates/finds company and deal
 * 2. Gathers context signals
 * 3. Generates AI recommendation
 * 4. Persists decision with context snapshot
 */
export async function processDecisionCreation(
  input: CreateDecisionInput
): Promise<DecisionResponse> {
  logger.info('Processing decision creation', {
    organizationId: input.organization_id,
    companyName: input.company.name,
    decisionType: input.decision_type,
  });

  // Step 1: Ensure company exists
  const company = await findOrCreateCompany(input.organization_id, input.company);

  // Step 2: Create deal if provided
  const deal = input.deal
    ? await findOrCreateDeal(company.id, input.deal)
    : null;

  // Step 3: Gather context signals
  const signals = await gatherContext({
    name: input.company.name,
    domain: input.company.domain,
    industry: input.company.industry,
    country: input.company.country,
  });

  // Step 4: Generate AI recommendation
  const recommendation = await generateDecisionRecommendation(
    {
      name: input.company.name,
      domain: input.company.domain,
      industry: input.company.industry,
      country: input.company.country,
    },
    signals,
    input.decision_type,
    input.deal?.amount
  );

  // Step 5: Map recommendation to database values
  const recommendedAction = recommendation.recommendation;
  const recommendedConfidence = recommendation.confidence.toUpperCase() as DecisionConfidence;

  // Step 6: Create decision with context snapshot
  const decisionData: DecisionCreateData = {
    organizationId: input.organization_id,
    companyId: company.id,
    dealId: deal?.id,
    decisionType: input.decision_type,
    recommendedAction,
    recommendedConfidence,
    contextSnapshot: {
      signals: signals as unknown, // Store as JSON
      agentRationale: recommendation.rationale.join('\n'),
    },
  };

  const decision = await createDecision(decisionData);

  logger.info('Decision created successfully', {
    decisionId: decision.id,
    recommendation: recommendation.recommendation,
  });

  // Step 7: Format response
  // Fetch the created decision with all relations for response
  const decisionWithRelations = await findDecisionById(decision.id);
  if (!decisionWithRelations) {
    throw new Error('Failed to fetch created decision');
  }
  
  return formatDecisionResponse(decisionWithRelations, recommendation);
}

/**
 * Process human review of a decision
 * 
 * Updates decision status and records override if applicable
 */
export async function processDecisionReview(
  decisionId: string,
  userId: string,
  input: ReviewDecisionInput
): Promise<DecisionResponse> {
  logger.info('Processing decision review', {
    decisionId,
    userId,
    action: input.action,
  });

  // Fetch existing decision
  const existingDecision = await findDecisionById(decisionId);
  if (!existingDecision) {
    throw new Error('Decision not found');
  }

  // Map action to status
  let status: DecisionStatus;
  let finalAction: string | undefined;

  switch (input.action) {
    case 'approve':
      status = 'APPROVED';
      finalAction = existingDecision.recommendedAction || 'approved';
      break;
    case 'reject':
      status = 'REJECTED';
      finalAction = 'rejected';
      break;
    case 'override':
      status = 'OVERRIDDEN';
      finalAction = input.final_action || 'overridden';
      break;
    default:
      throw new Error(`Invalid action: ${input.action}`);
  }

  // Update decision
  const updateData: DecisionUpdateData = {
    status,
    finalAction,
    decidedBy: userId,
    decidedAt: new Date(),
  };

  await updateDecisionStatus(
    decisionId,
    updateData,
    input.note, // Use note as override reason
    input.action === 'override' ? userId : undefined
  );

  // Fetch updated decision with all relations
  const updatedDecision = await findDecisionById(decisionId);

  if (!updatedDecision) {
    throw new Error('Failed to fetch updated decision');
  }

  logger.info('Decision review processed', {
    decisionId,
    status,
  });

  return formatDecisionResponse(updatedDecision);
}

/**
 * Get decision by ID with full context
 * Used for audit views and review UI
 */
export async function getDecisionById(
  decisionId: string,
  organizationId?: string
): Promise<DecisionResponse | null> {
  const decision = await findDecisionById(decisionId, organizationId);
  
  if (!decision) {
    return null;
  }

  return formatDecisionResponse(decision);
}

/**
 * Format database decision to API response
 */
function formatDecisionResponse(
  decision: Awaited<ReturnType<typeof findDecisionById>>,
  recommendation?: {
    recommendation: string;
    confidence: string;
    rationale: string[];
    suggested_conditions?: string[];
  }
): DecisionResponse {
  if (!decision) {
    throw new Error('Decision is null');
  }

  // Extract recommendation from context snapshot if not provided
  let rec = recommendation;
  if (!rec && decision.contextSnapshot?.agentRationale) {
    // Parse rationale back into structure (simple split for now)
    rec = {
      recommendation: decision.recommendedAction || 'review_manually',
      confidence: (decision.recommendedConfidence || 'LOW').toLowerCase(),
      rationale: decision.contextSnapshot.agentRationale.split('\n').filter(Boolean),
    };
  }

  return {
    id: decision.id,
    organization_id: decision.organizationId,
    company_id: decision.companyId,
    deal_id: decision.dealId || undefined,
    decision_type: decision.decisionType,
    status: decision.status,
    recommended_action: decision.recommendedAction || undefined,
    recommended_confidence: decision.recommendedConfidence || undefined,
    final_action: decision.finalAction || undefined,
    decided_by: decision.decidedBy || undefined,
    created_at: decision.createdAt,
    decided_at: decision.decidedAt || undefined,
    recommendation: rec,
    context: decision.contextSnapshot
      ? {
          signals: decision.contextSnapshot.signals,
          policies: decision.contextSnapshot.policies || undefined,
          agent_rationale: decision.contextSnapshot.agentRationale || undefined,
        }
      : undefined,
    overrides: decision.humanOverrides.map((o) => ({
      user_id: o.userId,
      override_reason: o.overrideReason || undefined,
      created_at: o.createdAt,
    })),
    links: decision.linksAsSource.map((l) => ({
      id: l.id,
      relationship_type: l.relationshipType,
      target_decision_id: l.toDecisionId,
    })),
  };
}
