import { AIReportStatus } from '@prisma/client';

export type { AIReportStatus };

export interface AIDecisionReportSummary {
  id: string;
  client_id: number;
  category_id: string;
  category: string;
  category_label?: string;
  title?: string;
  status: AIReportStatus;
  decision_count?: number;
  agent_model?: string;
  triggered_by?: number;
  generated_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface AIDecisionReportFull extends AIDecisionReportSummary {
  content?: string;
}

export interface TriggerReportInput {
  category_id: string; // UUID of ClientContextCategory
}

export interface ListReportsQuery {
  category_id?: string;
  status?: AIReportStatus;
}
