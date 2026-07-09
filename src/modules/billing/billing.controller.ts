import { Context } from "hono";
import { z } from "zod";
import { logger } from "../../utils/logger";
import { findClientById } from "../clients/clients.repository";
import {
  getBillingSummary,
  getPlanCatalog,
  startCheckout,
  startBillingPortal,
  previewPlanChange,
  cancelSubscription,
  reactivateSubscription,
} from "./billing.service";

function requireClientId(c: Context): number | null {
  const clientId = c.get("clientId");
  if (!clientId) return null;
  return clientId as number;
}

function handleBillingError(c: Context, error: unknown, action: string) {
  if (error instanceof Error) {
    const errorMap: Record<string, number> = {
      "No billing account found for this client": 404,
      "No active Stripe subscription to cancel": 404,
      "No active Stripe subscription to reactivate": 404,
      "Subscription is not scheduled for cancellation": 400,
      "Only GROWTH and SCALE plans are available through checkout": 400,
      "Only GROWTH and SCALE plans can be previewed through Stripe": 400,
    };
    const statusCode = errorMap[error.message];
    if (statusCode) {
      const label = statusCode === 404 ? "Not Found" : "Bad Request";
      return c.json({ error: label, message: error.message }, statusCode as 400 | 404);
    }
    if (error.message.endsWith("is not configured")) {
      return c.json({ error: "Not Configured", message: "Stripe is not configured on this server." }, 503);
    }
  }

  logger.error(`Error ${action}`, error instanceof Error ? error : new Error(String(error)));
  throw error;
}

export async function getBillingHandler(c: Context) {
  try {
    const clientId = requireClientId(c);
    if (!clientId) {
      return c.json({ error: "Bad Request", message: "Client context required." }, 400);
    }

    const summary = await getBillingSummary(clientId);
    return c.json(summary, 200);
  } catch (error) {
    return handleBillingError(c, error, "fetching billing summary");
  }
}

export async function getPlansHandler(c: Context) {
  return c.json({ data: getPlanCatalog() }, 200);
}

const checkoutSchema = z.object({
  plan: z.enum(["GROWTH", "SCALE"]),
  billing_cycle: z.enum(["MONTHLY", "ANNUAL"]),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
});

export async function createCheckoutHandler(c: Context) {
  try {
    const clientId = requireClientId(c);
    if (!clientId) {
      return c.json({ error: "Bad Request", message: "Client context required." }, 400);
    }

    const body = checkoutSchema.parse(await c.req.json());
    const client = await findClientById(clientId);
    if (!client) {
      return c.json({ error: "Not Found", message: "Client not found" }, 404);
    }

    const url = await startCheckout(
      clientId,
      client.name,
      body.plan,
      body.billing_cycle,
      body.success_url,
      body.cancel_url,
    );
    return c.json({ url }, 200);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation Error", message: "Invalid request body", details: error.errors }, 400);
    }
    return handleBillingError(c, error, "creating checkout session");
  }
}

const portalQuerySchema = z.object({
  return_url: z.string().url(),
});

export async function getPortalHandler(c: Context) {
  try {
    const clientId = requireClientId(c);
    if (!clientId) {
      return c.json({ error: "Bad Request", message: "Client context required." }, 400);
    }

    const query = portalQuerySchema.safeParse({ return_url: c.req.query("return_url") });
    if (!query.success) {
      return c.json({ error: "Bad Request", message: "Query parameter 'return_url' is required and must be a valid URL" }, 400);
    }

    const url = await startBillingPortal(clientId, query.data.return_url);
    return c.json({ url }, 200);
  } catch (error) {
    return handleBillingError(c, error, "creating billing portal session");
  }
}

const previewQuerySchema = z.object({
  plan: z.enum(["GROWTH", "SCALE"]),
  seat_count: z.coerce.number().int().positive(),
});

export async function getPreviewHandler(c: Context) {
  try {
    const clientId = requireClientId(c);
    if (!clientId) {
      return c.json({ error: "Bad Request", message: "Client context required." }, 400);
    }

    const query = previewQuerySchema.safeParse({
      plan: c.req.query("plan"),
      seat_count: c.req.query("seat_count"),
    });
    if (!query.success) {
      return c.json(
        { error: "Bad Request", message: "Query parameters 'plan' (GROWTH|SCALE) and 'seat_count' are required" },
        400,
      );
    }

    const preview = await previewPlanChange(clientId, query.data.plan, query.data.seat_count);
    return c.json(preview, 200);
  } catch (error) {
    return handleBillingError(c, error, "previewing plan change");
  }
}

export async function cancelBillingHandler(c: Context) {
  try {
    const clientId = requireClientId(c);
    if (!clientId) {
      return c.json({ error: "Bad Request", message: "Client context required." }, 400);
    }

    await cancelSubscription(clientId);
    return c.json({ success: true, message: "Subscription will cancel at the end of the current period" }, 200);
  } catch (error) {
    return handleBillingError(c, error, "canceling subscription");
  }
}

export async function reactivateBillingHandler(c: Context) {
  try {
    const clientId = requireClientId(c);
    if (!clientId) {
      return c.json({ error: "Bad Request", message: "Client context required." }, 400);
    }

    await reactivateSubscription(clientId);
    return c.json({ success: true, message: "Subscription reactivated" }, 200);
  } catch (error) {
    return handleBillingError(c, error, "reactivating subscription");
  }
}
