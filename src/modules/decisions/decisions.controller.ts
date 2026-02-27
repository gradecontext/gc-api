/**
 * Decisions Controller
 * Request/response handling for decision endpoints
 */

import { Context } from "hono";
import { z } from "zod";
import { logger } from "../../utils/logger";
import {
  processDecisionCreation,
  processDecisionReview,
  getDecisionById,
} from "./decisions.service";

const createDecisionSchema = z.object({
  client_id: z.number().int().positive(),
  subject_company: z.object({
    external_id: z.string().min(1),
    name: z.string().min(1),
    domain: z.string().url().optional().or(z.string().min(1).optional()),
    industry: z.string().optional(),
    country: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
  deal: z
    .object({
      crm_deal_id: z.string().optional(),
      amount: z.number().positive().optional(),
      currency: z.string().optional(),
      discount_requested: z.number().min(0).max(100).optional(),
    })
    .optional(),
  decision_type: z.enum([
    "DISCOUNT",
    "ONBOARDING",
    "PAYMENT_TERMS",
    "CREDIT_EXTENSION",
    "PARTNERSHIP",
    "RENEWAL",
    "ESCALATION",
    "CUSTOM",
  ]),
  context_key: z.string().optional(),
});

const reviewDecisionSchema = z.object({
  action: z.enum(["approve", "reject", "override", "escalate"]),
  note: z.string().optional(),
  final_action: z.string().optional(),
});

export async function createDecisionHandler(c: Context) {
  try {
    const body = createDecisionSchema.parse(await c.req.json());
    const clientId = c.get("clientId") || body.client_id;

    logger.info("Decision creation request received", {
      clientId,
      companyName: body.subject_company.name,
      externalId: body.subject_company.external_id,
    });

    const decision = await processDecisionCreation({
      ...body,
      client_id: clientId,
    });

    return c.json(decision, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { error: "Validation Error", message: "Invalid request body", details: error.errors },
        400,
      );
    }

    if (error instanceof Error && error.message === "Client not found") {
      return c.json({ error: "Not Found", message: "Client not found" }, 404);
    }

    if (error instanceof Error && error.message === "Client account is inactive") {
      return c.json({ error: "Forbidden", message: "Client account is inactive" }, 403);
    }

    logger.error("Error creating decision", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function reviewDecisionHandler(c: Context) {
  try {
    const decisionId = c.req.param("id");
    const body = reviewDecisionSchema.parse(await c.req.json());
    const userId = c.get("userId") || 0;

    logger.info("Decision review request received", {
      decisionId,
      action: body.action,
    });

    const decision = await processDecisionReview(decisionId, userId, body);

    return c.json(decision, 200);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { error: "Validation Error", message: "Invalid request body", details: error.errors },
        400,
      );
    }

    if (error instanceof Error && error.message === "Decision not found") {
      return c.json({ error: "Not Found", message: "Decision not found" }, 404);
    }

    logger.error("Error reviewing decision", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function getDecisionHandler(c: Context) {
  try {
    const decisionId = c.req.param("id");
    const clientId = c.get("clientId");

    logger.debug("Fetching decision", { decisionId });

    const decision = await getDecisionById(decisionId, clientId);

    if (!decision) {
      return c.json({ error: "Not Found", message: "Decision not found" }, 404);
    }

    return c.json(decision, 200);
  } catch (error) {
    logger.error("Error fetching decision", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
