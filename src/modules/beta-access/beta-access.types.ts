/**
 * Beta Access List module types
 */

import { PlanTier } from "@prisma/client";

export type { PlanTier };

export interface CreateBetaAccessInput {
  full_name: string;
  email: string;
  company_name?: string;
  number_of_users_range?: string;
  source?: string;
  plan_interest?: PlanTier;
  notes?: string;
}

export interface UpdateBetaAccessInput {
  full_name?: string;
  company_name?: string;
  number_of_users_range?: string;
  source?: string;
  plan_interest?: PlanTier | null;
  allow_access?: boolean;
  approved_by?: number | null;
  notes?: string;
}

export interface BetaAccessResponse {
  id: number;
  full_name: string;
  email: string;
  company_name: string | null;
  number_of_users_range: string | null;
  source: string | null;
  plan_interest: PlanTier | null;
  allow_access: boolean;
  approved_by: number | null;
  approved_by_admin?: {
    id: number;
    full_name: string;
    email: string;
  } | null;
  approved_at: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface BetaAccessListQuery {
  allow_access?: boolean;
  plan_interest?: PlanTier;
  page?: number;
  limit?: number;
}
