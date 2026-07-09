/**
 * Thin wrapper around the Stripe SDK. Every function here takes already-resolved
 * primitives (ids, price ids, quantities) — plan/seat business logic lives in
 * billing.service.ts, not here. Mirrors how billing.repository.ts is the
 * DB-facing counterpart.
 */

import Stripe from "stripe";
import { env } from "../../config/env";
import { BillingCycle, PlanTier } from "@prisma/client";

let _stripe: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!_stripe) {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    _stripe = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

type SellablePlan = "GROWTH" | "SCALE";

function isSellablePlan(plan: PlanTier): plan is SellablePlan {
  return plan === "GROWTH" || plan === "SCALE";
}

const PRICE_ENV_VARS: Record<SellablePlan, Record<BillingCycle, keyof typeof env>> = {
  GROWTH: {
    MONTHLY: "STRIPE_GROWTH_MONTHLY_PRICE_ID",
    ANNUAL: "STRIPE_GROWTH_ANNUAL_PRICE_ID",
  },
  SCALE: {
    MONTHLY: "STRIPE_SCALE_MONTHLY_PRICE_ID",
    ANNUAL: "STRIPE_SCALE_ANNUAL_PRICE_ID",
  },
};

/**
 * Resolve a Stripe Price id for a self-serve plan + billing cycle.
 * FREE and ENTERPRISE are never sold through Stripe Checkout.
 */
export function priceIdFor(plan: PlanTier, cycle: BillingCycle): string {
  if (!isSellablePlan(plan)) {
    throw new Error(`${plan} is not sold via Stripe Checkout`);
  }
  const envVar = PRICE_ENV_VARS[plan][cycle];
  const priceId = env[envVar];
  if (!priceId) {
    throw new Error(`${envVar} is not configured`);
  }
  return priceId;
}

/**
 * Reverse lookup — given a Stripe Price id (from a subscription/invoice
 * webhook payload), find which (plan, billingCycle) it corresponds to.
 */
export function planFromPriceId(priceId: string): { plan: PlanTier; billingCycle: BillingCycle } | null {
  for (const plan of Object.keys(PRICE_ENV_VARS) as SellablePlan[]) {
    for (const cycle of Object.keys(PRICE_ENV_VARS[plan]) as BillingCycle[]) {
      if (env[PRICE_ENV_VARS[plan][cycle]] === priceId) {
        return { plan, billingCycle: cycle };
      }
    }
  }
  return null;
}

export async function createStripeCustomer(name: string, metadata: Record<string, string>): Promise<string> {
  const customer = await getStripeClient().customers.create({ name, metadata });
  return customer.id;
}

/**
 * A stored stripe_customer_id can go stale if the Stripe environment behind
 * STRIPE_SECRET_KEY changes (switching sandboxes, resetting test data, etc.)
 * — the id simply won't exist there anymore. Callers use this to verify
 * before trusting a saved id instead of letting "No such customer" surface
 * as a raw 500.
 */
export async function customerExists(customerId: string): Promise<boolean> {
  try {
    const customer = await getStripeClient().customers.retrieve(customerId);
    return !("deleted" in customer && customer.deleted);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing") {
      return false;
    }
    throw error;
  }
}

export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  quantity: number;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}): Promise<string> {
  const session = await getStripeClient().checkout.sessions.create({
    mode: "subscription",
    customer: params.customerId,
    line_items: [{ price: params.priceId, quantity: params.quantity }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
    subscription_data: { metadata: params.metadata },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout session URL");
  }
  return session.url;
}

export async function createBillingPortalSession(customerId: string, returnUrl: string): Promise<string> {
  const session = await getStripeClient().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

export async function retrieveSubscription(stripeSubscriptionId: string): Promise<Stripe.Subscription> {
  return getStripeClient().subscriptions.retrieve(stripeSubscriptionId);
}

export async function updateSubscriptionQuantity(stripeSubscriptionId: string, quantity: number): Promise<void> {
  const subscription = await retrieveSubscription(stripeSubscriptionId);
  const item = subscription.items.data[0];
  if (!item) return;

  await getStripeClient().subscriptions.update(stripeSubscriptionId, {
    items: [{ id: item.id, quantity }],
    proration_behavior: "create_prorations",
  });
}

export async function setSubscriptionCancelAtPeriodEnd(
  stripeSubscriptionId: string,
  cancelAtPeriodEnd: boolean,
): Promise<void> {
  await getStripeClient().subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: cancelAtPeriodEnd,
  });
}

export async function previewUpcomingInvoice(params: {
  customerId: string;
  existingSubscriptionId?: string;
  priceId: string;
  quantity: number;
}): Promise<Stripe.Invoice> {
  return getStripeClient().invoices.createPreview({
    customer: params.customerId,
    subscription: params.existingSubscriptionId,
    subscription_details: {
      items: [{ price: params.priceId, quantity: params.quantity }],
      proration_behavior: "create_prorations",
    },
  });
}

export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  return getStripeClient().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
}
