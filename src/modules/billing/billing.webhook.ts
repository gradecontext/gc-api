/**
 * Stripe webhook endpoint — POST /api/v1/webhooks/stripe
 *
 * Reads the raw request body (no JSON parsing middleware exists globally in
 * this app — every other handler calls c.req.json() itself — so this route
 * simply reads text() instead, which is all raw-body signature verification
 * needs) and verifies the Stripe signature before trusting the payload.
 */

import { Hono } from "hono";
import Stripe from "stripe";
import { SubStatus } from "@prisma/client";
import { logger } from "../../utils/logger";
import { constructWebhookEvent, planFromPriceId } from "./billing.stripe";
import {
  activateFromCheckout,
  recordPaymentSucceeded,
  recordPaymentFailed,
  syncFromStripeSubscription,
  markSubscriptionCanceled,
} from "./billing.service";

const STRIPE_STATUS_MAP: Record<Stripe.Subscription.Status, SubStatus> = {
  active: "ACTIVE",
  past_due: "PAST_DUE",
  canceled: "CANCELED",
  incomplete: "INCOMPLETE",
  incomplete_expired: "CANCELED",
  trialing: "TRIALING",
  paused: "PAUSED",
  unpaid: "PAST_DUE",
};

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const clientId = Number(session.metadata?.clientId);
  const plan = session.metadata?.plan as "GROWTH" | "SCALE" | undefined;
  const billingCycle = session.metadata?.billingCycle as "MONTHLY" | "ANNUAL" | undefined;
  const stripeSubscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

  if (!clientId || !plan || !billingCycle || !stripeSubscriptionId) {
    logger.warn("checkout.session.completed missing required metadata", { sessionId: session.id });
    return;
  }

  await activateFromCheckout({ clientId, stripeSubscriptionId, plan, billingCycle });
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionRef = invoice.parent?.subscription_details?.subscription;
  const stripeSubscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;
  if (!stripeSubscriptionId) return;

  await recordPaymentSucceeded(
    stripeSubscriptionId,
    new Date(invoice.period_start * 1000),
    new Date(invoice.period_end * 1000),
  );
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionRef = invoice.parent?.subscription_details?.subscription;
  const stripeSubscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;
  if (!stripeSubscriptionId) return;

  await recordPaymentFailed(stripeSubscriptionId);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const item = subscription.items.data[0];
  if (!item) return;

  const priceId = typeof item.price === "string" ? item.price : item.price.id;
  const mapped = planFromPriceId(priceId);
  if (!mapped) {
    logger.warn("customer.subscription.updated with unrecognized price id", { priceId });
    return;
  }

  await syncFromStripeSubscription({
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    plan: mapped.plan,
    billingCycle: mapped.billingCycle,
    seatCount: item.quantity ?? 0,
    status: STRIPE_STATUS_MAP[subscription.status],
    currentPeriodStart: new Date(item.current_period_start * 1000),
    currentPeriodEnd: new Date(item.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  await markSubscriptionCanceled(subscription.id);
}

async function processStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(event.data.object);
    case "invoice.payment_succeeded":
      return handleInvoicePaymentSucceeded(event.data.object);
    case "invoice.payment_failed":
      return handleInvoicePaymentFailed(event.data.object);
    case "customer.subscription.updated":
      return handleSubscriptionUpdated(event.data.object);
    case "customer.subscription.deleted":
      return handleSubscriptionDeleted(event.data.object);
    default:
      // Unhandled event types are expected — Stripe sends far more than we subscribe to.
      return;
  }
}

const webhook = new Hono();

webhook.post("/webhooks/stripe", async (c) => {
  const signature = c.req.header("stripe-signature");
  if (!signature) {
    return c.json({ error: "Bad Request", message: "Missing stripe-signature header" }, 400);
  }

  const rawBody = await c.req.text();

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (error) {
    logger.warn("Stripe webhook signature verification failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ error: "Bad Request", message: "Invalid signature" }, 400);
  }

  try {
    await processStripeEvent(event);
  } catch (error) {
    logger.error(`Error processing Stripe webhook event (${event.type}, ${event.id})`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ error: "Internal Server Error", message: "Webhook processing failed" }, 500);
  }

  return c.json({ received: true }, 200);
});

export { webhook as billingWebhookRoutes };
