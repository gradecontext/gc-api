/**
 * Beta Access List Service
 * Business logic for beta access management
 */

import { logger } from "../../utils/logger";
import {
  createBetaAccess,
  findBetaAccessById,
  findBetaAccessByEmail,
  findBetaAccessEntries,
  updateBetaAccess,
  BetaAccessCreateData,
} from "./beta-access.repository";
import { findAdminById } from "../admins/admins.repository";
import {
  CreateBetaAccessInput,
  UpdateBetaAccessInput,
  BetaAccessResponse,
  BetaAccessListQuery,
} from "./beta-access.types";

type BetaAccessWithAdmin = NonNullable<Awaited<ReturnType<typeof findBetaAccessById>>>;

export async function createBetaAccessEntry(
  input: CreateBetaAccessInput,
): Promise<BetaAccessResponse> {
  logger.info("Creating beta access entry", { email: input.email });

  const existing = await findBetaAccessByEmail(input.email);
  if (existing) {
    throw new Error("Email already registered for beta access");
  }

  const data: BetaAccessCreateData = {
    fullName: input.full_name,
    email: input.email,
    companyName: input.company_name,
    numberOfUsersRange: input.number_of_users_range,
    source: input.source,
    planInterest: input.plan_interest,
    notes: input.notes,
  };

  const entry = await createBetaAccess(data);
  return formatBetaAccessResponse(entry);
}

export async function getBetaAccessById(id: number): Promise<BetaAccessResponse | null> {
  const entry = await findBetaAccessById(id);
  if (!entry) return null;
  return formatBetaAccessResponse(entry);
}

export async function listBetaAccessEntries(
  query: BetaAccessListQuery,
): Promise<{ entries: BetaAccessResponse[]; total: number; page: number; limit: number }> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 25;
  const skip = (page - 1) * limit;

  const { entries, total } = await findBetaAccessEntries({
    allowAccess: query.allow_access,
    planInterest: query.plan_interest,
    skip,
    take: limit,
  });

  return {
    entries: entries.map(formatBetaAccessResponse),
    total,
    page,
    limit,
  };
}

export async function updateBetaAccessDetails(
  id: number,
  input: UpdateBetaAccessInput,
): Promise<BetaAccessResponse> {
  const existing = await findBetaAccessById(id);
  if (!existing) {
    throw new Error("Beta access entry not found");
  }

  if (input.approved_by !== undefined && input.approved_by !== null) {
    const admin = await findAdminById(input.approved_by);
    if (!admin) {
      throw new Error("Admin not found");
    }
    if (!admin.active) {
      throw new Error("Cannot assign approval to an inactive admin");
    }
  }

  const approvedAt =
    input.allow_access === true && !existing.allowAccess
      ? new Date()
      : input.allow_access === false
        ? null
        : undefined;

  const entry = await updateBetaAccess(id, {
    fullName: input.full_name,
    companyName: input.company_name,
    numberOfUsersRange: input.number_of_users_range,
    source: input.source,
    planInterest: input.plan_interest,
    allowAccess: input.allow_access,
    approvedBy: input.approved_by,
    approvedAt,
    notes: input.notes,
  });

  logger.info("Beta access entry updated", { id, allowAccess: entry.allowAccess });

  return formatBetaAccessResponse(entry);
}

function formatBetaAccessResponse(entry: BetaAccessWithAdmin): BetaAccessResponse {
  return {
    id: entry.id,
    full_name: entry.fullName,
    email: entry.email,
    company_name: entry.companyName,
    number_of_users_range: entry.numberOfUsersRange,
    source: entry.source,
    plan_interest: entry.planInterest,
    allow_access: entry.allowAccess,
    approved_by: entry.approvedBy,
    approved_by_admin: entry.approvedByAdmin
      ? {
          id: entry.approvedByAdmin.id,
          full_name: entry.approvedByAdmin.fullName,
          email: entry.approvedByAdmin.email,
        }
      : null,
    approved_at: entry.approvedAt,
    notes: entry.notes,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}
