/**
 * Contact message module types
 */

export interface CreateContactInput {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  source?: string;
}

export interface UpdateContactInput {
  status?: "NEW" | "IN_PROGRESS" | "RESPONDED" | "CLOSED" | "SPAM";
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  contacted_by?: number | null;
}

export interface ContactResponse {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  source: string | null;
  status: string;
  priority: string;
  contacted_by: number | null;
  contacted_by_admin?: {
    id: number;
    full_name: string;
    email: string;
  } | null;
  responded_at: Date | null;
  ip_address: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ContactListQuery {
  status?: string;
  priority?: string;
  contacted_by?: number;
  page?: number;
  limit?: number;
}
