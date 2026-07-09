import { PlanTier, SubStatus } from "@prisma/client";
import { logger } from "../../utils/logger";
import {
  ensureSubscription,
  findSubscriptionByClientId,
  findSubscriptionByStripeCustomerId,
  findSubscriptionByStripeSubscriptionId,
  updateSubscriptionByClientId,
  updateSubscriptionById,
  countActiveMemberships,
  countCustomDecisionTypes,
  countReportsThisMonth,
  updateClientPlanMirror,
} from "./billing.repository";
import {
  createStripeCustomer,
  customerExists,
  createCheckoutSession,
  createBillingPortalSession,
  updateSubscriptionQuantity,
  setSubscriptionCancelAtPeriodEnd,
  previewUpcomingInvoice,
  priceIdFor,
} from "./billing.stripe";
import {
  PLAN_CONFIG,
  nextPlanAbove,
  FeatureFlag,
  FeatureAccess,
  SeatCheckResult,
  BillingSummary,
  PlanCatalogEntry,
  UpgradePreview,
  FeatureLimitExceededError,
} from "./billing.types";

// ── Plan / seat resolution ──────────────────────────────────────

export function resolvePlanForSeatCount(seats: number): PlanTier {
  if (seats <= PLAN_CONFIG.FREE.maxSeats!) return "FREE";
  if (seats <= PLAN_CONFIG.GROWTH.maxSeats!) return "GROWTH";
  if (seats <= PLAN_CONFIG.SCALE.maxSeats!) return "SCALE";
  return "ENTERPRISE";
}

export async function checkSeatLimit(clientId: number, addingSeats: number): Promise<SeatCheckResult> {
  const subscription = await ensureSubscription(clientId);
  const limits = PLAN_CONFIG[subscription.plan];

  if (limits.maxSeats === null) {
    return { allowed: true, currentPlan: subscription.plan };
  }

  const currentActive = await countActiveMemberships(clientId);
  const projected = currentActive + addingSeats;

  if (projected > limits.maxSeats) {
    return {
      allowed: false,
      reason: `Your plan allows up to ${limits.maxSeats} members. Upgrade to add more.`,
      currentPlan: subscription.plan,
      limit: limits.maxSeats,
      upgradeRequired: nextPlanAbove(subscription.plan),
    };
  }

  return { allowed: true, currentPlan: subscription.plan };
}

/**
 * Recomputes the client's active-membership count and writes it to
 * ClientSubscription.seatCount. Call after any membership approve / reject /
 * remove. If the client has a live Stripe subscription, also nudges Stripe's
 * quantity to match — billing accuracy, not a plan-tier change, so this is
 * exempt from the "no auto-upgrade" rule. Non-fatal: a Stripe hiccup here
 * must not block the membership action that triggered it.
 */
export async function syncSeatCount(clientId: number): Promise<void> {
  const subscription = await ensureSubscription(clientId);
  const seatCount = await countActiveMemberships(clientId);

  // ClientSubscription.seatCount reflects actual usage (shown as-is in
  // GET /billing) — but the Stripe quantity we bill on must never drop
  // below the plan's seat minimum, or a customer could shrink their team
  // to dodge the minimum charge (e.g. Scale's 16-seat/$192 floor).
  await updateSubscriptionByClientId(clientId, { seatCount });

  if (subscription.stripeSubscriptionId && (subscription.plan === "GROWTH" || subscription.plan === "SCALE")) {
    const billedQuantity = Math.max(PLAN_CONFIG[subscription.plan].minSeats, seatCount);
    try {
      await updateSubscriptionQuantity(subscription.stripeSubscriptionId, billedQuantity);
    } catch (error) {
      logger.warn("Failed to sync seat quantity to Stripe", {
        clientId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// ── Feature access ──────────────────────────────────────────────

export function hasFeatureAccess(plan: PlanTier, feature: FeatureFlag): FeatureAccess {
  return PLAN_CONFIG[plan].features[feature];
}

export async function assertCustomTypeAllowed(clientId: number): Promise<void> {
  const subscription = await ensureSubscription(clientId);
  const access = hasFeatureAccess(subscription.plan, "CUSTOM_TYPES");
  if (access === true) return;

  const limit = access === false ? 0 : access;
  const count = await countCustomDecisionTypes(clientId);
  if (count >= limit) {
    throw new FeatureLimitExceededError(
      "CUSTOM_TYPES",
      `Your plan allows up to ${limit} custom decision types. Upgrade to add more.`,
    );
  }
}

export async function assertAiReportAllowed(clientId: number): Promise<void> {
  const subscription = await ensureSubscription(clientId);
  const access = hasFeatureAccess(subscription.plan, "AI_REPORTS");
  if (access === true) return;

  const limit = access === false ? 0 : access;
  const count = await countReportsThisMonth(clientId);
  if (count >= limit) {
    throw new FeatureLimitExceededError(
      "AI_REPORTS",
      `Your plan allows up to ${limit} AI reports per month. Upgrade for unlimited reports.`,
    );
  }
}

// ── Billing summary / catalog ───────────────────────────────────

export async function getBillingSummary(clientId: number): Promise<BillingSummary> {
  const subscription = await ensureSubscription(clientId);
  const limits = PLAN_CONFIG[subscription.plan];

  return {
    plan: subscription.plan,
    status: subscription.status,
    billingCycle: subscription.billingCycle,
    seatCount: subscription.seatCount,
    seatLimit: limits.maxSeats,
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
    features: limits.features,
    stripeCustomerId: subscription.stripeCustomerId,
  };
}

export function getPlanCatalog(): PlanCatalogEntry[] {
  return (Object.keys(PLAN_CONFIG) as PlanTier[]).map((plan) => ({
    plan,
    ...PLAN_CONFIG[plan],
  }));
}

async function syncClientPlanMirror(clientId: number, plan: PlanTier): Promise<void> {
  await updateClientPlanMirror(clientId, plan);
}

// ── Stripe-facing actions (checkout / portal / cancel / reactivate) ────

// A stored stripe_customer_id can go stale (Stripe environment swapped,
// sandbox data reset, etc.) — always verify before trusting it rather than
// letting Stripe's "No such customer" surface as a raw 500. When stale, the
// dangling ids are cleared so callers fall back to "no billing account"
// (checkout re-creates a fresh customer; portal/preview report 404).
async function getVerifiedStripeCustomerId(clientId: number, subscription: { stripeCustomerId: string | null }): Promise<string | null> {
  if (!subscription.stripeCustomerId) return null;
  if (await customerExists(subscription.stripeCustomerId)) return subscription.stripeCustomerId;

  logger.warn("Stored Stripe customer id no longer exists — clearing it", {
    clientId,
    stripeCustomerId: subscription.stripeCustomerId,
  });
  await updateSubscriptionByClientId(clientId, { stripeCustomerId: null, stripeSubscriptionId: null });
  return null;
}

async function getOrCreateStripeCustomerId(clientId: number, clientName: string): Promise<string> {
  const subscription = await ensureSubscription(clientId);
  const verified = await getVerifiedStripeCustomerId(clientId, subscription);
  if (verified) return verified;

  const stripeCustomerId = await createStripeCustomer(clientName, { clientId: String(clientId) });
  await updateSubscriptionByClientId(clientId, { stripeCustomerId });
  return stripeCustomerId;
}

export async function startCheckout(
  clientId: number,
  clientName: string,
  plan: PlanTier,
  billingCycle: "MONTHLY" | "ANNUAL",
  successUrl: string,
  cancelUrl: string,
): Promise<string> {
  if (plan !== "GROWTH" && plan !== "SCALE") {
    throw new Error("Only GROWTH and SCALE plans are available through checkout");
  }

  const stripeCustomerId = await getOrCreateStripeCustomerId(clientId, clientName);
  const priceId = priceIdFor(plan, billingCycle);
  const seatCount = Math.max(PLAN_CONFIG[plan].minSeats, await countActiveMemberships(clientId));

  return createCheckoutSession({
    customerId: stripeCustomerId,
    priceId,
    quantity: seatCount,
    successUrl,
    cancelUrl,
    metadata: { clientId: String(clientId), plan, billingCycle },
  });
}

export async function startBillingPortal(clientId: number, returnUrl: string): Promise<string> {
  const subscription = await ensureSubscription(clientId);
  const stripeCustomerId = await getVerifiedStripeCustomerId(clientId, subscription);
  if (!stripeCustomerId) {
    throw new Error("No billing account found for this client");
  }
  return createBillingPortalSession(stripeCustomerId, returnUrl);
}

export async function previewPlanChange(
  clientId: number,
  newPlan: PlanTier,
  newSeatCount: number,
): Promise<UpgradePreview> {
  if (newPlan !== "GROWTH" && newPlan !== "SCALE") {
    throw new Error("Only GROWTH and SCALE plans can be previewed through Stripe");
  }

  const subscription = await ensureSubscription(clientId);
  const stripeCustomerId = await getVerifiedStripeCustomerId(clientId, subscription);
  if (!stripeCustomerId) {
    throw new Error("No billing account found for this client");
  }

  // Never preview below the plan's seat minimum — otherwise the quoted
  // amount wouldn't match what checkSeatLimit/syncSeatCount actually bill.
  const billedQuantity = Math.max(PLAN_CONFIG[newPlan].minSeats, newSeatCount);

  const priceId = priceIdFor(newPlan, subscription.billingCycle);
  const invoice = await previewUpcomingInvoice({
    customerId: stripeCustomerId,
    existingSubscriptionId: subscription.stripeSubscriptionId ?? undefined,
    priceId,
    quantity: billedQuantity,
  });

  return {
    plan: newPlan,
    billingCycle: subscription.billingCycle,
    seatCount: billedQuantity,
    amountDue: invoice.amount_due,
    currency: invoice.currency,
    prorationDate: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
  };
}

export async function cancelSubscription(clientId: number): Promise<void> {
  const subscription = await ensureSubscription(clientId);
  if (!subscription.stripeSubscriptionId) {
    throw new Error("No active Stripe subscription to cancel");
  }
  await setSubscriptionCancelAtPeriodEnd(subscription.stripeSubscriptionId, true);
  await updateSubscriptionByClientId(clientId, { cancelAtPeriodEnd: true });
}

export async function reactivateSubscription(clientId: number): Promise<void> {
  const subscription = await ensureSubscription(clientId);
  if (!subscription.stripeSubscriptionId) {
    throw new Error("No active Stripe subscription to reactivate");
  }
  if (!subscription.cancelAtPeriodEnd) {
    throw new Error("Subscription is not scheduled for cancellation");
  }
  await setSubscriptionCancelAtPeriodEnd(subscription.stripeSubscriptionId, false);
  await updateSubscriptionByClientId(clientId, { cancelAtPeriodEnd: false });
}

// ── Webhook-driven state transitions ────────────────────────────
// Called only from billing.webhook.ts, after Stripe signature verification.
// Each of these mirrors the resulting plan onto Client.plan so existing
// consumers (/users/me, membership responses) stay in sync automatically.

export async function activateFromCheckout(params: {
  clientId: number;
  stripeSubscriptionId: string;
  plan: PlanTier;
  billingCycle: "MONTHLY" | "ANNUAL";
}): Promise<void> {
  const seatCount = await countActiveMemberships(params.clientId);
  await updateSubscriptionByClientId(params.clientId, {
    stripeSubscriptionId: params.stripeSubscriptionId,
    plan: params.plan,
    billingCycle: params.billingCycle,
    status: "ACTIVE",
    seatCount,
  });
  await syncClientPlanMirror(params.clientId, params.plan);
}

export async function recordPaymentSucceeded(
  stripeSubscriptionId: string,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
): Promise<void> {
  const subscription = await findSubscriptionByStripeSubscriptionId(stripeSubscriptionId);
  if (!subscription) {
    logger.warn("Stripe invoice.payment_succeeded for unknown subscription", { stripeSubscriptionId });
    return;
  }
  await updateSubscriptionById(subscription.id, {
    status: "ACTIVE",
    currentPeriodStart,
    currentPeriodEnd,
  });
}

export async function recordPaymentFailed(stripeSubscriptionId: string): Promise<void> {
  const subscription = await findSubscriptionByStripeSubscriptionId(stripeSubscriptionId);
  if (!subscription) {
    logger.warn("Stripe invoice.payment_failed for unknown subscription", { stripeSubscriptionId });
    return;
  }
  await updateSubscriptionById(subscription.id, { status: "PAST_DUE" });
  logger.warn("Subscription past due", { clientId: subscription.clientId, stripeSubscriptionId });
}

export async function syncFromStripeSubscription(params: {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  plan: PlanTier;
  billingCycle: "MONTHLY" | "ANNUAL";
  seatCount: number;
  status: SubStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}): Promise<void> {
  const subscription =
    (await findSubscriptionByStripeSubscriptionId(params.stripeSubscriptionId)) ??
    (await findSubscriptionByStripeCustomerId(params.stripeCustomerId));

  if (!subscription) {
    logger.warn("Stripe customer.subscription.updated for unknown subscription", {
      stripeSubscriptionId: params.stripeSubscriptionId,
    });
    return;
  }

  await updateSubscriptionById(subscription.id, {
    stripeSubscriptionId: params.stripeSubscriptionId,
    plan: params.plan,
    billingCycle: params.billingCycle,
    seatCount: params.seatCount,
    status: params.status,
    currentPeriodStart: params.currentPeriodStart,
    currentPeriodEnd: params.currentPeriodEnd,
    cancelAtPeriodEnd: params.cancelAtPeriodEnd,
  });
  await syncClientPlanMirror(subscription.clientId, params.plan);
}

export async function markSubscriptionCanceled(stripeSubscriptionId: string): Promise<void> {
  const subscription = await findSubscriptionByStripeSubscriptionId(stripeSubscriptionId);
  if (!subscription) {
    logger.warn("Stripe customer.subscription.deleted for unknown subscription", { stripeSubscriptionId });
    return;
  }

  await updateSubscriptionById(subscription.id, {
    status: "CANCELED",
    plan: "FREE",
    stripeSubscriptionId: null,
    cancelAtPeriodEnd: false,
  });
  await syncClientPlanMirror(subscription.clientId, "FREE");
}

export { findSubscriptionByClientId };
