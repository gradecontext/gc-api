/**
 * Lead module types
 */

import { LeadStatus, ClientPlan } from '@prisma/client';

export type { LeadStatus, ClientPlan };

export interface CreateLeadInput {
  email: string;
  full_name?: string;
  company_name?: string;
  company_size?: string;
  company_website?: string;
  plan_interest?: ClientPlan;
  message?: string;
}

export interface UpdateLeadInput {
  full_name?: string;
  company_name?: string;
  company_size?: string;
  company_website?: string;
  plan_interest?: ClientPlan | null;
  message?: string;
  contacted?: boolean;
  status?: LeadStatus;
  represented_by?: number | null;
  converted_to_user_id?: number | null;
  converted_to_client_id?: number | null;
}

export interface LeadResponse {
  id: number;
  email: string;
  full_name: string | null;
  company_name: string | null;
  company_size: string | null;
  company_website: string | null;
  plan_interest: ClientPlan | null;
  message: string | null;
  contacted: boolean;
  status: LeadStatus;
  converted_to_user_id: number | null;
  converted_to_client_id: number | null;
  represented_by: number | null;
  represented_by_admin?: {
    id: number;
    full_name: string;
    email: string;
  } | null;
  created_at: Date;
  updated_at: Date;
}

export interface LeadListQuery {
  status?: LeadStatus;
  contacted?: boolean;
  represented_by?: number;
  page?: number;
  limit?: number;
}
