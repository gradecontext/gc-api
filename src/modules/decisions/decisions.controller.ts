import { Context } from "hono";
import { z } from "zod";
import { logger } from "../../utils/logger";
import {
  processDecisionCreation,
  processDecisionReview,
  getDecisionById,
  listDecisions,
  getDecisionContexts,
  addNoteToDecision,
  getDecisionTypes,
  addDecisionType,
  editDecisionType,
  removeDecisionType,
  getContextCategories,
  addContextCategory,
  editContextCategory,
  removeContextCategory,
  getSubjectCompanies,
  addSubjectCompany,
  editSubjectCompany,
  removeSubjectCompany,
} from "./decisions.service";

const createDecisionSchema = z.object({
  client_id: z.number().int().positive().optional(),
  // References an existing subject company/source (e.g. "figma.com") registered
  // via /decisions/subject-companies. Decision logging never creates one.
  external_id: z.string().min(1),
  deal: z
    .object({
      crm_deal_id: z.string().optional(),
      amount: z.number().positive().optional(),
      currency: z.string().optional(),
      discount_requested: z.number().min(0).max(100).optional(),
    })
    .optional(),
  decision_type: z.string().min(1), // validated against client's ClientDecisionType table
  context_key: z.string().optional(),
  summary: z.string().min(1).optional(),
  note: z
    .object({
      content: z.string().min(1),
      source_app: z.string().optional(),
      source_url: z.string().optional(),
    })
    .optional(),
});

const reviewDecisionSchema = z.object({
  action: z.enum(["approve", "reject", "override", "escalate"]),
  note: z.string().optional(),
  final_action: z.string().optional(),
});

const createDecisionTypeSchema = z.object({
  decision_type: z.string().min(1).max(100),
  label: z.string().max(255).optional(),
});

const updateDecisionTypeSchema = z.object({
  decision_type: z.string().min(1).max(100).optional(),
  label: z.string().max(255).optional(),
  active: z.boolean().optional(),
});

const createContextCategorySchema = z.object({
  category: z.string().min(1).max(100),
  label: z.string().max(255).optional(),
});

const updateContextCategorySchema = z.object({
  category: z.string().min(1).max(100).optional(),
  label: z.string().max(255).optional(),
  active: z.boolean().optional(),
});

const createSubjectCompanySchema = z
  .object({
    external_id: z.string().min(1).optional(),
    name: z.string().min(1),
    domain: z.string().min(1).optional(),
    industry: z.string().optional(),
    country: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine((data) => !!(data.external_id || data.domain), {
    message: "Either external_id or domain is required",
    path: ["domain"],
  });

const updateSubjectCompanySchema = z.object({
  name: z.string().min(1).optional(),
  domain: z.string().min(1).optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  active: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

function requireClientId(c: Context) {
  const clientId = c.get("clientId");
  if (!clientId) {
    return null;
  }
  return clientId as number;
}

// ============================================================
// DECISIONS
// ============================================================

export async function listDecisionsHandler(c: Context) {
  try {
    const clientId = requireClientId(c);
    if (!clientId) {
      return c.json({ error: "Bad Request", message: "Client context required. Pass X-Client-Id header or ensure your account has exactly one active membership." }, 400);
    }

    const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") ?? "20", 10) || 20));
    const status = c.req.query("status");
    const decision_type = c.req.query("decision_type");

    const mine = c.req.query("mine") === "true";
    const userId = c.get("userId") as number | undefined;
    if (mine && !userId) {
      return c.json({ error: "Bad Request", message: "The 'mine' filter requires an authenticated user session (not available for API-key callers)." }, 400);
    }

    const loggedByParam = c.req.query("logged_by");
    const decidedByParam = c.req.query("decided_by");
    const loggedBy = mine ? userId : (loggedByParam ? parseInt(loggedByParam, 10) : undefined);
    const decidedBy = decidedByParam ? parseInt(decidedByParam, 10) : undefined;

    const result = await listDecisions({ clientId, status, decisionType: decision_type, loggedBy, decidedBy, page, limit });

    return c.json(result, 200);
  } catch (error) {
    logger.error("Error listing decisions", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function listDecisionContextsHandler(c: Context) {
  try {
    const clientId = requireClientId(c);
    if (!clientId) {
      return c.json({ error: "Bad Request", message: "Client context required. Pass X-Client-Id header or ensure your account has exactly one active membership." }, 400);
    }

    const contexts = await getDecisionContexts(clientId);

    return c.json({ data: contexts }, 200);
  } catch (error) {
    logger.error("Error listing decision contexts", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function addDecisionNoteHandler(c: Context) {
  try {
    const decisionId = c.req.param("id");
    const clientId = c.get("clientId");
    const userId = c.get("userId") as number | undefined;

    const bodySchema = z.object({
      content: z.string().min(1),
      source_app: z.string().optional(),
      source_url: z.string().optional(),
    });

    const body = bodySchema.parse(await c.req.json());

    const note = await addNoteToDecision(decisionId, userId, body, clientId);

    return c.json(note, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation Error", message: "Invalid request body", details: error.errors }, 400);
    }
    if (error instanceof Error && error.message === "Decision not found") {
      return c.json({ error: "Not Found", message: "Decision not found" }, 404);
    }
    logger.error("Error adding decision note", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function createDecisionHandler(c: Context) {
  try {
    const body = createDecisionSchema.parse(await c.req.json());
    const clientId = (c.get("clientId") as number | undefined) ?? body.client_id;

    if (!clientId) {
      return c.json({ error: "Bad Request", message: "Client context required. Pass X-Client-Id header or ensure your account has exactly one active membership." }, 400);
    }

    const userId = c.get("userId") as number | undefined;

    logger.info("Decision creation request received", {
      clientId,
      externalId: body.external_id,
    });

    const decision = await processDecisionCreation(
      {
        ...body,
        client_id: clientId,
      },
      userId
    );

    return c.json(decision, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation Error", message: "Invalid request body", details: error.errors }, 400);
    }
    if (error instanceof Error && error.message === "Client not found") {
      return c.json({ error: "Not Found", message: "Client not found" }, 404);
    }
    if (error instanceof Error && error.message === "Client account is inactive") {
      return c.json({ error: "Forbidden", message: "Client account is inactive" }, 403);
    }
    if (
      error instanceof Error &&
      (error.message.startsWith("Decision type '") ||
        error.message.startsWith("Context '") ||
        error.message.startsWith("Subject company '"))
    ) {
      return c.json({ error: "Bad Request", message: error.message }, 400);
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

    logger.info("Decision review request received", { decisionId, action: body.action });

    const decision = await processDecisionReview(decisionId, userId, body);

    return c.json(decision, 200);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation Error", message: "Invalid request body", details: error.errors }, 400);
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

// ============================================================
// CLIENT DECISION TYPES
// ============================================================

export async function listDecisionTypesHandler(c: Context) {
  try {
    const clientId = requireClientId(c);
    if (!clientId) {
      return c.json({ error: "Bad Request", message: "Client context required." }, 400);
    }

    const types = await getDecisionTypes(clientId);
    return c.json({ data: types }, 200);
  } catch (error) {
    logger.error("Error listing decision types", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function createDecisionTypeHandler(c: Context) {
  try {
    const clientId = requireClientId(c);
    if (!clientId) {
      return c.json({ error: "Bad Request", message: "Client context required." }, 400);
    }

    const body = createDecisionTypeSchema.parse(await c.req.json());
    const type = await addDecisionType(clientId, body);
    return c.json(type, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation Error", message: "Invalid request body", details: error.errors }, 400);
    }
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return c.json({ error: "Conflict", message: "A decision type with that value already exists for this client." }, 409);
    }
    logger.error("Error creating decision type", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function updateDecisionTypeHandler(c: Context) {
  try {
    const clientId = requireClientId(c);
    if (!clientId) {
      return c.json({ error: "Bad Request", message: "Client context required." }, 400);
    }

    const id = c.req.param("typeId");
    const body = updateDecisionTypeSchema.parse(await c.req.json());
    const type = await editDecisionType(id, clientId, body);
    return c.json(type, 200);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation Error", message: "Invalid request body", details: error.errors }, 400);
    }
    if (error instanceof Error && error.message === "Decision type not found") {
      return c.json({ error: "Not Found", message: "Decision type not found" }, 404);
    }
    if (error instanceof Error && error.message === "Cannot modify a reserved decision type") {
      return c.json({ error: "Forbidden", message: "Cannot modify a reserved decision type" }, 403);
    }
    logger.error("Error updating decision type", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function deleteDecisionTypeHandler(c: Context) {
  try {
    const clientId = requireClientId(c);
    if (!clientId) {
      return c.json({ error: "Bad Request", message: "Client context required." }, 400);
    }

    const id = c.req.param("typeId");
    await removeDecisionType(id, clientId);
    return c.json({ success: true }, 200);
  } catch (error) {
    if (error instanceof Error && error.message === "Decision type not found") {
      return c.json({ error: "Not Found", message: "Decision type not found" }, 404);
    }
    if (error instanceof Error && error.message === "Cannot delete a reserved decision type") {
      return c.json({ error: "Forbidden", message: "Cannot delete a reserved decision type" }, 403);
    }
    logger.error("Error deleting decision type", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

// ============================================================
// CLIENT CONTEXT CATEGORIES
// ============================================================

export async function listContextCategoriesHandler(c: Context) {
  try {
    const clientId = requireClientId(c);
    if (!clientId) {
      return c.json({ error: "Bad Request", message: "Client context required." }, 400);
    }

    const categories = await getContextCategories(clientId);
    return c.json({ data: categories }, 200);
  } catch (error) {
    logger.error("Error listing context categories", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function createContextCategoryHandler(c: Context) {
  try {
    const clientId = requireClientId(c);
    if (!clientId) {
      return c.json({ error: "Bad Request", message: "Client context required." }, 400);
    }

    const body = createContextCategorySchema.parse(await c.req.json());
    const category = await addContextCategory(clientId, body);
    return c.json(category, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation Error", message: "Invalid request body", details: error.errors }, 400);
    }
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return c.json({ error: "Conflict", message: "A context category with that value already exists for this client." }, 409);
    }
    logger.error("Error creating context category", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function updateContextCategoryHandler(c: Context) {
  try {
    const clientId = requireClientId(c);
    if (!clientId) {
      return c.json({ error: "Bad Request", message: "Client context required." }, 400);
    }

    const id = c.req.param("categoryId");
    const body = updateContextCategorySchema.parse(await c.req.json());
    const category = await editContextCategory(id, clientId, body);
    return c.json(category, 200);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation Error", message: "Invalid request body", details: error.errors }, 400);
    }
    if (error instanceof Error && error.message === "Context category not found") {
      return c.json({ error: "Not Found", message: "Context category not found" }, 404);
    }
    if (error instanceof Error && error.message === "Cannot modify a reserved context category") {
      return c.json({ error: "Forbidden", message: "Cannot modify a reserved context category" }, 403);
    }
    logger.error("Error updating context category", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function deleteContextCategoryHandler(c: Context) {
  try {
    const clientId = requireClientId(c);
    if (!clientId) {
      return c.json({ error: "Bad Request", message: "Client context required." }, 400);
    }

    const id = c.req.param("categoryId");
    await removeContextCategory(id, clientId);
    return c.json({ success: true }, 200);
  } catch (error) {
    if (error instanceof Error && error.message === "Context category not found") {
      return c.json({ error: "Not Found", message: "Context category not found" }, 404);
    }
    if (error instanceof Error && error.message === "Cannot delete a reserved context category") {
      return c.json({ error: "Forbidden", message: "Cannot delete a reserved context category" }, 403);
    }
    logger.error("Error deleting context category", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

// ============================================================
// SUBJECT COMPANIES (SOURCES)
// ============================================================

export async function listSubjectCompaniesHandler(c: Context) {
  try {
    const clientId = requireClientId(c);
    if (!clientId) {
      return c.json({ error: "Bad Request", message: "Client context required." }, 400);
    }

    const companies = await getSubjectCompanies(clientId);
    return c.json({ data: companies }, 200);
  } catch (error) {
    logger.error("Error listing subject companies", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function createSubjectCompanyHandler(c: Context) {
  try {
    const clientId = requireClientId(c);
    if (!clientId) {
      return c.json({ error: "Bad Request", message: "Client context required." }, 400);
    }

    const body = createSubjectCompanySchema.parse(await c.req.json());
    const company = await addSubjectCompany(clientId, body);
    return c.json(company, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation Error", message: "Invalid request body", details: error.errors }, 400);
    }
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return c.json({ error: "Conflict", message: "A subject company with that external_id already exists for this client." }, 409);
    }
    logger.error("Error creating subject company", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function updateSubjectCompanyHandler(c: Context) {
  try {
    const clientId = requireClientId(c);
    if (!clientId) {
      return c.json({ error: "Bad Request", message: "Client context required." }, 400);
    }

    const id = parseInt(c.req.param("subjectCompanyId"), 10);
    const body = updateSubjectCompanySchema.parse(await c.req.json());
    const company = await editSubjectCompany(id, clientId, body);
    return c.json(company, 200);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation Error", message: "Invalid request body", details: error.errors }, 400);
    }
    if (error instanceof Error && error.message === "Subject company not found") {
      return c.json({ error: "Not Found", message: "Subject company not found" }, 404);
    }
    logger.error("Error updating subject company", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function deleteSubjectCompanyHandler(c: Context) {
  try {
    const clientId = requireClientId(c);
    if (!clientId) {
      return c.json({ error: "Bad Request", message: "Client context required." }, 400);
    }

    const id = parseInt(c.req.param("subjectCompanyId"), 10);
    await removeSubjectCompany(id, clientId);
    return c.json({ success: true }, 200);
  } catch (error) {
    if (error instanceof Error && error.message === "Subject company not found") {
      return c.json({ error: "Not Found", message: "Subject company not found" }, 404);
    }
    logger.error("Error deleting subject company", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
