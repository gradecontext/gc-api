/**
 * Decision module types
 * Central type definitions for the decisions domain
 */

import {
  DecisionType,
  DecisionStatus,
  DecisionConfidence,
} from '@prisma/client';

export type { DecisionType, DecisionStatus, DecisionConfidence };

export interface CreateDecisionInput {
  organization_id: string;
  company: {
    name: string;
    domain?: string;
    industry?: string;
    country?: string;
  };
  deal?: {
    crm_deal_id?: string;
    amount?: number;
    currency?: string;
    discount_requested?: number;
  };
  decision_type: DecisionType;
}

export interface ReviewDecisionInput {
  action: 'approve' | 'reject' | 'override';
  note?: string;
  final_action?: string; // Custom action if override
}

export interface DecisionResponse {
  id: string;
  organization_id: string;
  company_id: string;
  deal_id?: string;
  decision_type: DecisionType;
  status: DecisionStatus;
  recommended_action?: string;
  recommended_confidence?: DecisionConfidence;
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
  };
  overrides?: Array<{
    user_id: string;
    override_reason?: string;
    created_at: Date;
  }>;
  links?: Array<{
    id: string;
    relationship_type: string;
    target_decision_id: string;
  }>;
}
