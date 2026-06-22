import { prisma } from '../../db/client';
import { Prisma } from '@prisma/client';

export async function createObservedEvent(data: {
  clientId: number;
  sourceApp: string;
  eventType: string;
  sourceUrl?: string;
  externalEntityId?: string;
  title?: string;
  description?: string;
  occurredByUserId?: number;
  rawPayload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  occurredAt: Date;
  convertedToDecisionId?: string;
}) {
  return await prisma.observedEvent.create({
    data: {
      clientId: data.clientId,
      sourceApp: data.sourceApp,
      eventType: data.eventType,
      sourceUrl: data.sourceUrl ?? null,
      externalEntityId: data.externalEntityId ?? null,
      title: data.title ?? null,
      description: data.description ?? null,
      occurredByUserId: data.occurredByUserId ?? null,
      rawPayload: data.rawPayload ? (data.rawPayload as Prisma.InputJsonValue) : undefined,
      metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : undefined,
      occurredAt: data.occurredAt,
      convertedToDecisionId: data.convertedToDecisionId ?? null,
    },
  });
}
