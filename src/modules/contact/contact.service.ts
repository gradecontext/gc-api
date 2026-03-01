/**
 * Contact Messages Service
 * Business logic for contact message management
 */

import { logger } from "../../utils/logger";
import {
  createContactMessage,
  findContactById,
  findContacts,
  updateContactMessage,
  ContactCreateData,
} from "./contact.repository";
import { findAdminById } from "../admins/admins.repository";
import {
  CreateContactInput,
  UpdateContactInput,
  ContactResponse,
  ContactListQuery,
} from "./contact.types";

type ContactWithAdmin = NonNullable<Awaited<ReturnType<typeof findContactById>>>;

export async function createContact(
  input: CreateContactInput,
  meta?: { ipAddress?: string; userAgent?: string },
): Promise<ContactResponse> {
  logger.info("Creating contact message", { email: input.email, subject: input.subject });

  const data: ContactCreateData = {
    name: input.name,
    email: input.email,
    phone: input.phone,
    subject: input.subject,
    message: input.message,
    source: input.source,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  };

  const contact = await createContactMessage(data);
  return formatContactResponse(contact);
}

export async function getContactById(id: number): Promise<ContactResponse | null> {
  const contact = await findContactById(id);
  if (!contact) return null;
  return formatContactResponse(contact);
}

export async function listContacts(
  query: ContactListQuery,
): Promise<{ messages: ContactResponse[]; total: number; page: number; limit: number }> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 25;
  const skip = (page - 1) * limit;

  const { messages, total } = await findContacts({
    status: query.status as any,
    priority: query.priority as any,
    contactedBy: query.contacted_by,
    skip,
    take: limit,
  });

  return {
    messages: messages.map(formatContactResponse),
    total,
    page,
    limit,
  };
}

export async function updateContactDetails(
  id: number,
  input: UpdateContactInput,
): Promise<ContactResponse> {
  const existing = await findContactById(id);
  if (!existing) {
    throw new Error("Contact message not found");
  }

  if (input.contacted_by !== undefined && input.contacted_by !== null) {
    const admin = await findAdminById(input.contacted_by);
    if (!admin) {
      throw new Error("Admin not found");
    }
    if (!admin.active) {
      throw new Error("Cannot assign contact message to an inactive admin");
    }
  }

  const respondedAt =
    input.status === "RESPONDED" && existing.respondedAt === null
      ? new Date()
      : undefined;

  const contact = await updateContactMessage(id, {
    status: input.status as any,
    priority: input.priority as any,
    contactedBy: input.contacted_by,
    respondedAt,
  });

  logger.info("Contact message updated", { id, status: contact.status });

  return formatContactResponse(contact);
}

function formatContactResponse(contact: ContactWithAdmin): ContactResponse {
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    subject: contact.subject,
    message: contact.message,
    source: contact.source,
    status: contact.status,
    priority: contact.priority,
    contacted_by: contact.contactedBy,
    contacted_by_admin: contact.contactedByAdmin
      ? {
          id: contact.contactedByAdmin.id,
          full_name: contact.contactedByAdmin.fullName,
          email: contact.contactedByAdmin.email,
        }
      : null,
    responded_at: contact.respondedAt,
    ip_address: contact.ipAddress,
    created_at: contact.createdAt,
    updated_at: contact.updatedAt,
  };
}
