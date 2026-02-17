/**
 * Leads Service
 * Business logic for lead management and conversion
 */

import { logger } from '../../utils/logger';
import { prisma } from '../../db/client';
import {
  createLead,
  findLeadById,
  findLeads,
  updateLead,
  LeadCreateData,
} from './leads.repository';
import { findAdminById } from '../admins/admins.repository';
import {
  CreateLeadInput,
  UpdateLeadInput,
  LeadResponse,
  LeadListQuery,
} from './leads.types';

type LeadWithAdmin = NonNullable<Awaited<ReturnType<typeof findLeadById>>>;

/**
 * Create a new lead
 */
export async function createNewLead(
  input: CreateLeadInput
): Promise<LeadResponse> {
  logger.info('Creating lead', { email: input.email });

  const data: LeadCreateData = {
    email: input.email,
    fullName: input.full_name,
    companyName: input.company_name,
    companySize: input.company_size,
    companyWebsite: input.company_website,
    planInterest: input.plan_interest,
    message: input.message,
  };

  const lead = await createLead(data);
  return formatLeadResponse(lead);
}

/**
 * Get a single lead by ID
 */
export async function getLeadById(id: number): Promise<LeadResponse | null> {
  const lead = await findLeadById(id);
  if (!lead) return null;
  return formatLeadResponse(lead);
}

/**
 * List leads with filtering and pagination
 */
export async function listLeads(
  query: LeadListQuery
): Promise<{ leads: LeadResponse[]; total: number; page: number; limit: number }> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 25;
  const skip = (page - 1) * limit;

  const { leads, total } = await findLeads({
    status: query.status,
    contacted: query.contacted,
    representedBy: query.represented_by,
    skip,
    take: limit,
  });

  return {
    leads: leads.map(formatLeadResponse),
    total,
    page,
    limit,
  };
}

/**
 * Update a lead (status, assignment, contact flag, conversion, etc.)
 */
export async function updateLeadDetails(
  id: number,
  input: UpdateLeadInput
): Promise<LeadResponse> {
  const existing = await findLeadById(id);
  if (!existing) {
    throw new Error('Lead not found');
  }

  // Validate admin reference if assigning
  if (input.represented_by !== undefined && input.represented_by !== null) {
    const admin = await findAdminById(input.represented_by);
    if (!admin) {
      throw new Error('Admin not found');
    }
    if (!admin.active) {
      throw new Error('Cannot assign lead to an inactive admin');
    }
  }

  // Validate user reference if converting
  if (input.converted_to_user_id !== undefined && input.converted_to_user_id !== null) {
    const user = await prisma.user.findUnique({
      where: { id: input.converted_to_user_id },
      select: { id: true },
    });
    if (!user) {
      throw new Error('Converted user not found');
    }
  }

  // Validate client reference if converting
  if (input.converted_to_client_id !== undefined && input.converted_to_client_id !== null) {
    const client = await prisma.client.findUnique({
      where: { id: input.converted_to_client_id },
      select: { id: true },
    });
    if (!client) {
      throw new Error('Converted client not found');
    }
  }

  // Auto-set status to CONVERTED if conversion IDs are provided
  let status = input.status;
  if (
    (input.converted_to_user_id || input.converted_to_client_id) &&
    !status
  ) {
    status = 'CONVERTED';
  }

  const lead = await updateLead(id, {
    fullName: input.full_name,
    companyName: input.company_name,
    companySize: input.company_size,
    companyWebsite: input.company_website,
    planInterest: input.plan_interest,
    message: input.message,
    contacted: input.contacted,
    status,
    representedBy: input.represented_by,
    convertedToUserId: input.converted_to_user_id,
    convertedToClientId: input.converted_to_client_id,
  });

  logger.info('Lead updated', { id, status: lead.status });

  return formatLeadResponse(lead);
}

/**
 * Format database lead to API response
 */
function formatLeadResponse(lead: LeadWithAdmin): LeadResponse {
  return {
    id: lead.id,
    email: lead.email,
    full_name: lead.fullName,
    company_name: lead.companyName,
    company_size: lead.companySize,
    company_website: lead.companyWebsite,
    plan_interest: lead.planInterest,
    message: lead.message,
    contacted: lead.contacted,
    status: lead.status,
    converted_to_user_id: lead.convertedToUserId,
    converted_to_client_id: lead.convertedToClientId,
    represented_by: lead.representedBy,
    represented_by_admin: lead.representedByAdmin
      ? {
          id: lead.representedByAdmin.id,
          full_name: lead.representedByAdmin.fullName,
          email: lead.representedByAdmin.email,
        }
      : null,
    created_at: lead.createdAt,
    updated_at: lead.updatedAt,
  };
}
