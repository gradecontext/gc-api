import { prisma } from '../../db/client';
import { createObservedEvent } from './events.repository';
import { CreateObservedEventInput, ObservedEventResponse } from './events.types';

export async function logObservedEvent(
  input: CreateObservedEventInput,
  resolvedClientId: number,
  userId?: number
): Promise<ObservedEventResponse> {
  const client = await prisma.client.findUnique({
    where: { id: resolvedClientId },
    select: { id: true, active: true },
  });

  if (!client) throw new Error('Client not found');
  if (!client.active) throw new Error('Client account is inactive');

  const occurredAt = input.occurred_at ? new Date(input.occurred_at) : new Date();

  const event = await createObservedEvent({
    clientId: resolvedClientId,
    sourceApp: input.source_app,
    eventType: input.event_type,
    sourceUrl: input.source_url,
    externalEntityId: input.external_entity_id,
    title: input.title,
    description: input.description,
    occurredByUserId: userId,
    rawPayload: input.raw_payload,
    metadata: input.metadata,
    occurredAt,
    convertedToDecisionId: input.converted_to_decision_id,
  });

  return {
    id: event.id,
    client_id: event.clientId,
    source_app: event.sourceApp,
    event_type: event.eventType,
    source_url: event.sourceUrl ?? undefined,
    external_entity_id: event.externalEntityId ?? undefined,
    title: event.title ?? undefined,
    description: event.description ?? undefined,
    occurred_by_user_id: event.occurredByUserId ?? undefined,
    converted_to_decision_id: event.convertedToDecisionId ?? undefined,
    occurred_at: event.occurredAt,
    created_at: event.createdAt,
  };
}
