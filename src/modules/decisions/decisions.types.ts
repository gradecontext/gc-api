import {
  DecisionStatus,
  DecisionConfidence,
  DecisionUrgency,
} from '@prisma/client';

export type { DecisionStatus, DecisionConfidence, DecisionUrgency };

export interface CreateDecisionInput {
  client_id: number;
  // References an existing SubjectCompany.externalId for this client (e.g. "figma.com").
  // Decisions never create subject companies — see /decisions/subject-companies for that.
  external_id: string;
  deal?: {
    crm_deal_id?: string;
    amount?: number;
    currency?: string;
    discount_requested?: number;
  };
  decision_type: string; // value from ClientDecisionType.decisionType
  context_key?: string;
  summary?: string;      // human-written title (e.g. "Change base color to navy")
  note?: {              // optional inline note — saved after decision creation
    content: string;
    source_app?: string;
    source_url?: string;
  };
}

export interface ReviewDecisionInput {
  action: 'approve' | 'reject' | 'override' | 'escalate';
  note?: string;
  final_action?: string;
}

export interface ListDecisionsInput {
  client_id?: number;
  status?: string;
  decision_type?: string;
  logged_by?: number;
  decided_by?: number;
  page?: number;
  limit?: number;
}

export interface ListDecisionsResponse {
  data: DecisionSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface DecisionSummary {
  id: string;
  decision_type: string;
  status: DecisionStatus;
  urgency: DecisionUrgency;
  summary?: string;
  recommended_action?: string;
  recommended_confidence?: DecisionConfidence;
  final_action?: string;
  logged_by?: number;
  logged_by_user?: {
    id: number;
    name?: string;
  };
  created_at: Date;
  decided_at?: Date;
  subject_company?: {
    id: number;
    name: string;
    domain?: string;
  };
}

export interface DecisionContextItem {
  id: string;
  key: string;
  name: string;
  description?: string;
  category: string;
  active: boolean;
}

export interface AddDecisionNoteInput {
  content: string;
  source_app?: string;
  source_url?: string;
}

export interface DecisionNoteResponse {
  id: string;
  decision_id: string;
  author_id?: number;
  content: string;
  source_app?: string;
  source_url?: string;
  created_at: Date;
  author?: {
    id: number;
    name?: string;
    email: string;
  };
}

export interface DecisionResponse {
  id: string;
  client_id: number;
  subject_company_id: number;
  deal_id?: string;
  context_key?: string;
  decision_type: string;
  status: DecisionStatus;
  urgency?: DecisionUrgency;
  summary?: string;
  recommended_action?: string;
  recommended_confidence?: DecisionConfidence;
  suggested_conditions?: unknown;
  final_action?: string;
  decided_by?: number;
  logged_by?: number;
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
  notes?: Array<{
    id: string;
    author_id?: number;
    content: string;
    source_app?: string;
    source_url?: string;
    created_at: Date;
    author?: {
      id: number;
      name?: string;
      email: string;
    };
  }>;
  overrides?: Array<{
    user_id: number;
    override_action: string;
    override_reason?: string;
    created_at: Date;
    user?: {
      id: number;
      name?: string;
      email: string;
      title?: string;
    };
  }>;
  links?: Array<{
    id: string;
    relationship_type: string;
    target_decision_id: string;
    confidence?: number;
    related_decision?: {
      id: string;
      status: string;
      summary?: string;
      decision_type?: string;
      created_at: Date;
    };
  }>;
  subject_company?: {
    id: number;
    external_id: string;
    name: string;
    domain?: string;
    industry?: string;
    country?: string;
  };
  decided_by_user?: {
    id: number;
    name?: string;
    title?: string;
  };
  logged_by_user?: {
    id: number;
    name?: string;
    title?: string;
  };
}

// ---- Client Decision Type management ----

export interface ClientDecisionTypeItem {
  id: string;
  client_id: number;
  decision_type: string;
  label?: string;
  is_reserved: boolean;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateDecisionTypeInput {
  decision_type: string;
  label?: string;
}

export interface UpdateDecisionTypeInput {
  decision_type?: string;
  label?: string;
  active?: boolean;
}

// ---- Client Context Category management ----

export interface ClientContextCategoryItem {
  id: string;
  client_id: number;
  category: string;
  label?: string;
  is_reserved: boolean;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateContextCategoryInput {
  category: string;
  label?: string;
}

export interface UpdateContextCategoryInput {
  category?: string;
  label?: string;
  active?: boolean;
}

// ---- Subject Company (Source) management ----

export interface SubjectCompanyItem {
  id: number;
  client_id: number;
  external_id: string;
  name: string;
  domain?: string;
  industry?: string;
  country?: string;
  active: boolean;
  metadata?: unknown;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSubjectCompanyInput {
  external_id?: string; // derived from domain (then name) if omitted
  name: string;
  domain?: string;
  industry?: string;
  country?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateSubjectCompanyInput {
  name?: string;
  domain?: string;
  industry?: string;
  country?: string;
  active?: boolean;
  metadata?: Record<string, unknown>;
}
