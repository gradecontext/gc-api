/**
 * Decision module types
 * Central type definitions for the decisions domain
 */

import {
  DecisionType,
  DecisionStatus,
  DecisionConfidence,
  DecisionUrgency,
} from '@prisma/client';

export type { DecisionType, DecisionStatus, DecisionConfidence, DecisionUrgency };

export interface CreateDecisionInput {
  tenant_id: string;
  subject_company: {
    external_id: string;
    name: string;
    domain?: string;
    industry?: string;
    country?: string;
    metadata?: Record<string, unknown>;
  };
  deal?: {
    crm_deal_id?: string;
    amount?: number;
    currency?: string;
    discount_requested?: number;
  };
  decision_type: DecisionType;
  context_key?: string; // Key referencing a DecisionContext
}

export interface ReviewDecisionInput {
  action: 'approve' | 'reject' | 'override' | 'escalate';
  note?: string;
  final_action?: string; // Custom action if override
}

export interface DecisionResponse {
  id: string;
  tenant_id: string;
  subject_company_id: string;
  deal_id?: string;
  context_key?: string;
  decision_type: DecisionType;
  status: DecisionStatus;
  urgency?: DecisionUrgency;
  recommended_action?: string;
  recommended_confidence?: DecisionConfidence;
  suggested_conditions?: unknown;
  final_action?: string;
  decided_by?: string;
  created_at: Date;
  decided_at?: Date;
  recommendation?: {
    recommendation: string;
    confidence: string;
    rationale: string[];
    suggested_conditions?: string[];
  };
  context?: {
    signals: unknown;
    policies?: unknown;
    agent_rationale?: string;
    agent_model?: string;
  };
  overrides?: Array<{
    user_id: string;
    override_action: string;
    override_reason?: string;
    created_at: Date;
  }>;
  links?: Array<{
    id: string;
    relationship_type: string;
    target_decision_id: string;
    confidence?: number;
  }>;
  subject_company?: {
    id: string;
    external_id: string;
    name: string;
    domain?: string;
    industry?: string;
    country?: string;
  };
}
