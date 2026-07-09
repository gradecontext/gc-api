import { prisma } from "../../db/client";
import { BillingCycle, Prisma, PlanTier, SubStatus } from "@prisma/client";

export async function findSubscriptionByClientId(clientId: number) {
  return prisma.clientSubscription.findUnique({ where: { clientId } });
}

export async function findSubscriptionByStripeCustomerId(stripeCustomerId: string) {
  return prisma.clientSubscription.findUnique({ where: { stripeCustomerId } });
}

export async function findSubscriptionByStripeSubscriptionId(stripeSubscriptionId: string) {
  return prisma.clientSubscription.findUnique({ where: { stripeSubscriptionId } });
}

// Defensive fallback for clients created before trg_client_seed_subscription
// existed (i.e. before this migration is applied) — the trigger is the
// normal path, this just avoids a null-pointer in that gap.
export async function ensureSubscription(clientId: number) {
  const existing = await findSubscriptionByClientId(clientId);
  if (existing) return existing;

  return prisma.clientSubscription.create({
    data: { clientId, plan: "FREE", status: "ACTIVE" },
  });
}

export async function updateSubscriptionByClientId(
  clientId: number,
  data: Prisma.ClientSubscriptionUpdateInput,
) {
  return prisma.clientSubscription.update({ where: { clientId }, data });
}

export async function updateSubscriptionById(
  id: string,
  data: Prisma.ClientSubscriptionUpdateInput,
) {
  return prisma.clientSubscription.update({ where: { id }, data });
}

export async function countActiveMemberships(clientId: number): Promise<number> {
  return prisma.membership.count({ where: { clientId, status: "ACTIVE" } });
}

export async function countCustomDecisionTypes(clientId: number): Promise<number> {
  return prisma.clientDecisionType.count({ where: { clientId, isReserved: false } });
}

export async function countReportsThisMonth(clientId: number): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  return prisma.aIDecisionReport.count({
    where: { clientId, createdAt: { gte: startOfMonth } },
  });
}

export async function updateClientPlanMirror(clientId: number, plan: PlanTier) {
  return prisma.client.update({ where: { id: clientId }, data: { plan } });
}

export type { BillingCycle, PlanTier, SubStatus };
