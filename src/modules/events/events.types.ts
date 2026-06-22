export interface CreateObservedEventInput {
  client_id?: number;
  source_app: string;
  event_type: string;
  source_url?: string;
  external_entity_id?: string;
  title?: string;
  description?: string;
  raw_payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  occurred_at?: string; // ISO 8601 — defaults to now
  converted_to_decision_id?: string;
}

export interface ObservedEventResponse {
  id: string;
  client_id: number;
  source_app: string;
  event_type: string;
  source_url?: string;
  external_entity_id?: string;
  title?: string;
  description?: string;
  occurred_by_user_id?: number;
  converted_to_decision_id?: string;
  occurred_at: Date;
  created_at: Date;
}
