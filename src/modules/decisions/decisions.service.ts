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
  findOrCreateSubjectCompany,
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
 * 1. Creates/finds subject company and deal
 * 2. Gathers context signals
 * 3. Generates AI recommendation
 * 4. Persists decision with context snapshot
 */
export async function processDecisionCreation(
  input: CreateDecisionInput
): Promise<DecisionResponse> {
  logger.info('Processing decision creation', {
    clientId: input.client_id,
    companyName: input.subject_company.name,
    decisionType: input.decision_type,
  });

  // Step 1: Ensure subject company exists (upsert by externalId)
  const subjectCompany = await findOrCreateSubjectCompany(input.client_id, {
    externalId: input.subject_company.external_id,
    name: input.subject_company.name,
    domain: input.subject_company.domain,
    industry: input.subject_company.industry,
    country: input.subject_company.country,
    metadata: input.subject_company.metadata,
  });

  // Step 2: Create deal if provided
  const deal = input.deal
    ? await findOrCreateDeal(subjectCompany.id, input.deal)
    : null;

  // Step 3: Gather context signals
  const startTime = Date.now();
  const signals = await gatherContext({
    name: input.subject_company.name,
    domain: input.subject_company.domain,
    industry: input.subject_company.industry,
    country: input.subject_company.country,
  });
  const processingTimeMs = Date.now() - startTime;

  // Step 4: Generate AI recommendation
  const recommendation = await generateDecisionRecommendation(
    {
      name: input.subject_company.name,
      domain: input.subject_company.domain,
      industry: input.subject_company.industry,
      country: input.subject_company.country,
    },
    signals,
    input.decision_type,
    input.deal?.amount
  );

  // Step 5: Map recommendation to database values
  const recommendedAction = recommendation.recommendation;
  const recommendedConfidence = recommendation.confidence.toUpperCase() as DecisionConfidence;

  // Step 6: Build human-readable summary for the UI
  const summary = `${input.subject_company.name} ${input.decision_type.replace(/_/g, ' ').toLowerCase()} request`;

  // Step 7: Create decision with context snapshot
  const decisionData: DecisionCreateData = {
    clientId: input.client_id,
    subjectCompanyId: subjectCompany.id,
    dealId: deal?.id,
    decisionType: input.decision_type,
    summary,
    recommendedAction,
    recommendedConfidence,
    suggestedConditions: recommendation.suggested_conditions,
    contextSnapshot: {
      signals: signals as unknown, // Store as JSON
      agentRationale: recommendation.rationale.join('\n'),
      processingTimeMs,
    },
  };

  const decision = await createDecision(decisionData);

  logger.info('Decision created successfully', {
    decisionId: decision.id,
    recommendation: recommendation.recommendation,
  });

  // Step 8: Format response
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
  userId: number,
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
    case 'escalate':
      status = 'ESCALATED';
      finalAction = 'escalated';
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
  clientId?: number
): Promise<DecisionResponse | null> {
  const decision = await findDecisionById(decisionId, clientId);
  
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
    client_id: decision.clientId,
    subject_company_id: decision.subjectCompanyId,
    deal_id: decision.dealId || undefined,
    context_key: decision.context?.key || undefined,
    decision_type: decision.decisionType,
    status: decision.status,
    urgency: decision.urgency,
    summary: decision.summary || undefined,
    recommended_action: decision.recommendedAction || undefined,
    recommended_confidence: decision.recommendedConfidence || undefined,
    suggested_conditions: decision.suggestedConditions || undefined,
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
          agent_model: decision.contextSnapshot.agentModel || undefined,
        }
      : undefined,
    overrides: decision.humanOverrides.map((o) => ({
      user_id: o.userId,
      override_action: o.overrideAction,
      override_reason: o.overrideReason || undefined,
      created_at: o.createdAt,
    })),
    links: decision.linksAsSource.map((l) => ({
      id: l.id,
      relationship_type: l.relationshipType,
      target_decision_id: l.toDecisionId,
      confidence: l.confidence ? Number(l.confidence) : undefined,
    })),
    subject_company: decision.subjectCompany
      ? {
          id: decision.subjectCompany.id,
          external_id: decision.subjectCompany.externalId,
          name: decision.subjectCompany.name,
          domain: decision.subjectCompany.domain || undefined,
          industry: decision.subjectCompany.industry || undefined,
          country: decision.subjectCompany.country || undefined,
        }
      : undefined,
    decided_by_user: decision.decisionMaker
      ? {
          id: decision.decisionMaker.id,
          name: decision.decisionMaker.name || undefined,
          title: decision.decisionMaker.title || undefined,
        }
      : undefined,
  };
}
