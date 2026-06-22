import { logger } from '../../utils/logger';
import {
  createDecision,
  findDecisionById,
  updateDecisionStatus,
  findOrCreateSubjectCompany,
  findOrCreateDeal,
  listDecisions as listDecisionsFromRepo,
  listDecisionContexts,
  findDecisionContextByKey,
  addDecisionNote,
  findClientDecisionTypeByValue,
  listClientDecisionTypes,
  createClientDecisionType,
  updateClientDecisionType,
  deleteClientDecisionType,
  findClientDecisionTypeById,
  listClientContextCategories,
  createClientContextCategory,
  updateClientContextCategory,
  deleteClientContextCategory,
  findClientContextCategoryById,
  DecisionCreateData,
  DecisionUpdateData,
} from './decisions.repository';
import { prisma } from '../../db/client';
import {
  CreateDecisionInput,
  ReviewDecisionInput,
  DecisionResponse,
  ClientDecisionTypeItem,
  ClientContextCategoryItem,
  CreateDecisionTypeInput,
  UpdateDecisionTypeInput,
  CreateContextCategoryInput,
  UpdateContextCategoryInput,
} from './decisions.types';
import { DecisionStatus } from '@prisma/client';

export async function processDecisionCreation(
  input: CreateDecisionInput,
  loggedBy?: number
): Promise<DecisionResponse> {
  logger.info('Processing decision creation', {
    clientId: input.client_id,
    companyName: input.subject_company.name,
    decisionType: input.decision_type,
  });

  const client = await prisma.client.findUnique({
    where: { id: input.client_id },
    select: { id: true, active: true },
  });

  if (!client) throw new Error('Client not found');
  if (!client.active) throw new Error('Client account is inactive');

  // Resolve decision_type string → ClientDecisionType FK
  const clientDecisionType = await findClientDecisionTypeByValue(
    input.client_id,
    input.decision_type
  );
  if (!clientDecisionType) {
    throw new Error(`Decision type '${input.decision_type}' not found for this client`);
  }
  if (!clientDecisionType.active) {
    throw new Error(`Decision type '${input.decision_type}' is inactive`);
  }

  // Resolve context_key string → DecisionContext FK (drives AI report category scoping)
  let contextId: string | undefined;
  if (input.context_key) {
    const context = await findDecisionContextByKey(input.client_id, input.context_key);
    if (!context) {
      throw new Error(`Context '${input.context_key}' not found for this client`);
    }
    if (!context.active) {
      throw new Error(`Context '${input.context_key}' is inactive`);
    }
    contextId = context.id;
  }

  const derivedExternalId =
    input.subject_company.external_id ||
    input.subject_company.domain?.replace(/^https?:\/\//, '').replace(/\/$/, '') ||
    input.subject_company.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const subjectCompany = await findOrCreateSubjectCompany(input.client_id, {
    externalId: derivedExternalId,
    name: input.subject_company.name,
    domain: input.subject_company.domain,
    industry: input.subject_company.industry,
    country: input.subject_company.country,
    metadata: input.subject_company.metadata,
  });

  const deal = input.deal ? await findOrCreateDeal(subjectCompany.id, input.deal) : null;

  // Prefer caller-supplied summary; fall back to auto-generated one
  const summary =
    input.summary ||
    `${input.subject_company.name} ${clientDecisionType.decisionType.replace(/_/g, ' ').toLowerCase()} request`;

  // No AI recommendation at log time — use POST /ai-reports/generate to trigger analysis
  const decisionData: DecisionCreateData = {
    clientId: input.client_id,
    subjectCompanyId: subjectCompany.id,
    dealId: deal?.id,
    contextId,
    decisionTypeId: clientDecisionType.id,
    summary,
    loggedBy,
  };

  const decision = await createDecision(decisionData);

  // Save inline note if provided (extension sends decision + why in one shot)
  if (input.note?.content) {
    await addDecisionNote({
      decisionId: decision.id,
      authorId: loggedBy,
      content: input.note.content,
      sourceApp: input.note.source_app,
      sourceUrl: input.note.source_url,
    });
  }

  logger.info('Decision created', { decisionId: decision.id });

  const decisionWithRelations = await findDecisionById(decision.id);
  if (!decisionWithRelations) throw new Error('Failed to fetch created decision');

  return formatDecisionResponse(decisionWithRelations);
}

export async function processDecisionReview(
  decisionId: string,
  userId: number,
  input: ReviewDecisionInput
): Promise<DecisionResponse> {
  logger.info('Processing decision review', { decisionId, userId, action: input.action });

  const existingDecision = await findDecisionById(decisionId);
  if (!existingDecision) throw new Error('Decision not found');

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

  const updateData: DecisionUpdateData = { status, finalAction, decidedBy: userId, decidedAt: new Date() };

  await updateDecisionStatus(
    decisionId,
    updateData,
    input.note,
    input.action === 'override' ? userId : undefined
  );

  const updatedDecision = await findDecisionById(decisionId);
  if (!updatedDecision) throw new Error('Failed to fetch updated decision');

  logger.info('Decision review processed', { decisionId, status });

  return formatDecisionResponse(updatedDecision);
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
  const { decisions, total } = await listDecisionsFromRepo(params);

  const data = decisions.map((d) => ({
    id: d.id,
    decision_type: d.clientDecisionType?.decisionType ?? '',
    status: d.status,
    urgency: d.urgency,
    summary: d.summary ?? undefined,
    recommended_action: d.recommendedAction ?? undefined,
    recommended_confidence: d.recommendedConfidence ?? undefined,
    final_action: d.finalAction ?? undefined,
    logged_by: d.loggedBy ?? undefined,
    logged_by_user: d.loggedByUser
      ? { id: d.loggedByUser.id, name: d.loggedByUser.name ?? undefined }
      : undefined,
    created_at: d.createdAt,
    decided_at: d.decidedAt ?? undefined,
    subject_company: d.subjectCompany
      ? { id: d.subjectCompany.id, name: d.subjectCompany.name, domain: d.subjectCompany.domain ?? undefined }
      : undefined,
  }));

  return { data, total, page: params.page, limit: params.limit };
}

export async function getDecisionContexts(clientId: number) {
  return await listDecisionContexts(clientId);
}

export async function addNoteToDecision(
  decisionId: string,
  userId: number | undefined,
  input: { content: string; source_app?: string; source_url?: string },
  clientId?: number
) {
  const existing = await findDecisionById(decisionId, clientId);
  if (!existing) throw new Error('Decision not found');

  const note = await addDecisionNote({
    decisionId,
    authorId: userId,
    content: input.content,
    sourceApp: input.source_app,
    sourceUrl: input.source_url,
  });

  return {
    id: note.id,
    decision_id: note.decisionId,
    author_id: note.authorId ?? undefined,
    content: note.content,
    source_app: note.sourceApp ?? undefined,
    source_url: note.sourceUrl ?? undefined,
    created_at: note.createdAt,
  };
}

export async function getDecisionById(decisionId: string, clientId?: number): Promise<DecisionResponse | null> {
  const decision = await findDecisionById(decisionId, clientId);
  if (!decision) return null;
  return formatDecisionResponse(decision);
}

function formatDecisionResponse(
  decision: Awaited<ReturnType<typeof findDecisionById>>,
  recommendation?: {
    recommendation: string;
    confidence: string;
    rationale: string[];
    suggested_conditions?: string[];
  }
): DecisionResponse {
  if (!decision) throw new Error('Decision is null');

  let rec = recommendation;
  if (!rec && decision.contextSnapshot?.agentRationale) {
    rec = {
      recommendation: decision.recommendedAction || 'review_manually',
      confidence: (decision.recommendedConfidence || 'LOW').toLowerCase(),
      rationale: decision.contextSnapshot.agentRationale.split('\n').filter(Boolean),
    };
  }

  return {
    id: decision.id,
    client_id: decision.clientId,
    subject_company_id: decision.subjectCompanyId!,
    deal_id: decision.dealId || undefined,
    context_key: decision.context?.key || undefined,
    decision_type: decision.clientDecisionType?.decisionType ?? '',
    status: decision.status,
    urgency: decision.urgency,
    summary: decision.summary || undefined,
    recommended_action: decision.recommendedAction || undefined,
    recommended_confidence: decision.recommendedConfidence || undefined,
    suggested_conditions: decision.suggestedConditions || undefined,
    final_action: decision.finalAction || undefined,
    decided_by: decision.decidedBy || undefined,
    logged_by: decision.loggedBy || undefined,
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
    notes: decision.notes.map((n) => ({
      id: n.id,
      author_id: n.authorId || undefined,
      content: n.content,
      source_app: n.sourceApp || undefined,
      source_url: n.sourceUrl || undefined,
      created_at: n.createdAt,
      author: n.author
        ? { id: n.author.id, name: n.author.name || undefined, email: n.author.email }
        : undefined,
    })),
    overrides: decision.humanOverrides.map((o) => ({
      user_id: o.userId,
      override_action: o.overrideAction,
      override_reason: o.overrideReason || undefined,
      created_at: o.createdAt,
      user: o.user
        ? { id: o.user.id, name: o.user.name || undefined, email: o.user.email, title: o.user.title || undefined }
        : undefined,
    })),
    links: decision.linksAsSource.map((l) => ({
      id: l.id,
      relationship_type: l.relationshipType,
      target_decision_id: l.toDecisionId,
      confidence: l.confidence ? Number(l.confidence) : undefined,
      related_decision: l.targetDecision
        ? {
            id: l.targetDecision.id,
            status: l.targetDecision.status,
            summary: l.targetDecision.summary || undefined,
            decision_type: l.targetDecision.clientDecisionType?.decisionType || undefined,
            created_at: l.targetDecision.createdAt,
          }
        : undefined,
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
      ? { id: decision.decisionMaker.id, name: decision.decisionMaker.name || undefined, title: decision.decisionMaker.title || undefined }
      : undefined,
    logged_by_user: decision.loggedByUser
      ? { id: decision.loggedByUser.id, name: decision.loggedByUser.name || undefined, title: decision.loggedByUser.title || undefined }
      : undefined,
  };
}

// ============================================================
// CLIENT DECISION TYPE SERVICE
// ============================================================

function formatDecisionType(row: Awaited<ReturnType<typeof findClientDecisionTypeById>>): ClientDecisionTypeItem {
  if (!row) throw new Error('Decision type not found');
  return {
    id: row.id,
    client_id: row.clientId,
    decision_type: row.decisionType,
    label: row.label ?? undefined,
    is_reserved: row.isReserved,
    active: row.active,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function getDecisionTypes(clientId: number): Promise<ClientDecisionTypeItem[]> {
  const rows = await listClientDecisionTypes(clientId);
  return rows.map((r) => ({
    id: r.id,
    client_id: r.clientId,
    decision_type: r.decisionType,
    label: r.label ?? undefined,
    is_reserved: r.isReserved,
    active: r.active,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  }));
}

export async function addDecisionType(
  clientId: number,
  input: CreateDecisionTypeInput
): Promise<ClientDecisionTypeItem> {
  const row = await createClientDecisionType(clientId, {
    decisionType: input.decision_type,
    label: input.label,
  });
  return formatDecisionType(row);
}

export async function editDecisionType(
  id: string,
  clientId: number,
  input: UpdateDecisionTypeInput
): Promise<ClientDecisionTypeItem> {
  const existing = await findClientDecisionTypeById(id, clientId);
  if (!existing) throw new Error('Decision type not found');
  if (existing.isReserved) throw new Error('Cannot modify a reserved decision type');

  const row = await updateClientDecisionType(id, input);
  return formatDecisionType(row);
}

export async function removeDecisionType(id: string, clientId: number): Promise<void> {
  const existing = await findClientDecisionTypeById(id, clientId);
  if (!existing) throw new Error('Decision type not found');
  if (existing.isReserved) throw new Error('Cannot delete a reserved decision type');

  await deleteClientDecisionType(id);
}

// ============================================================
// CLIENT CONTEXT CATEGORY SERVICE
// ============================================================

function formatContextCategory(row: Awaited<ReturnType<typeof findClientContextCategoryById>>): ClientContextCategoryItem {
  if (!row) throw new Error('Context category not found');
  return {
    id: row.id,
    client_id: row.clientId,
    category: row.category,
    label: row.label ?? undefined,
    is_reserved: row.isReserved,
    active: row.active,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function getContextCategories(clientId: number): Promise<ClientContextCategoryItem[]> {
  const rows = await listClientContextCategories(clientId);
  return rows.map((r) => ({
    id: r.id,
    client_id: r.clientId,
    category: r.category,
    label: r.label ?? undefined,
    is_reserved: r.isReserved,
    active: r.active,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  }));
}

export async function addContextCategory(
  clientId: number,
  input: CreateContextCategoryInput
): Promise<ClientContextCategoryItem> {
  const row = await createClientContextCategory(clientId, {
    category: input.category,
    label: input.label,
  });
  return formatContextCategory(row);
}

export async function editContextCategory(
  id: string,
  clientId: number,
  input: UpdateContextCategoryInput
): Promise<ClientContextCategoryItem> {
  const existing = await findClientContextCategoryById(id, clientId);
  if (!existing) throw new Error('Context category not found');
  if (existing.isReserved) throw new Error('Cannot modify a reserved context category');

  const row = await updateClientContextCategory(id, input);
  return formatContextCategory(row);
}

export async function removeContextCategory(id: string, clientId: number): Promise<void> {
  const existing = await findClientContextCategoryById(id, clientId);
  if (!existing) throw new Error('Context category not found');
  if (existing.isReserved) throw new Error('Cannot delete a reserved context category');

  await deleteClientContextCategory(id);
}
