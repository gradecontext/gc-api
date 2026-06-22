import { Hono } from "hono";
import {
  createDecisionHandler,
  reviewDecisionHandler,
  getDecisionHandler,
  listDecisionsHandler,
  listDecisionContextsHandler,
  addDecisionNoteHandler,
  listDecisionTypesHandler,
  createDecisionTypeHandler,
  updateDecisionTypeHandler,
  deleteDecisionTypeHandler,
  listContextCategoriesHandler,
  createContextCategoryHandler,
  updateContextCategoryHandler,
  deleteContextCategoryHandler,
} from "./decisions.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";

const decisions = new Hono();

// Reviewing a decision (approve/reject/override/escalate) is a judgment call —
// restricted to roles the product spec describes as making/approving decisions.
const reviewerRoles = requireRole("OWNER", "ADMIN", "APPROVER");
// Decision types & context categories are organization-wide taxonomy — admin-managed,
// per "Client admins can add unlimited custom types/categories" in the product spec.
const adminRoles = requireRole("OWNER", "ADMIN");

// Decisions
decisions.get("/decisions", authenticate, listDecisionsHandler);
decisions.get("/decisions/contexts", authenticate, listDecisionContextsHandler);
decisions.post("/decisions", authenticate, createDecisionHandler);

// Client Decision Types (custom + reserved) — must be registered before "/decisions/:id"
// so literal segments like "types" aren't swallowed by the :id param.
decisions.get("/decisions/types", authenticate, listDecisionTypesHandler);
decisions.post("/decisions/types", authenticate, adminRoles, createDecisionTypeHandler);
decisions.put("/decisions/types/:typeId", authenticate, adminRoles, updateDecisionTypeHandler);
decisions.delete("/decisions/types/:typeId", authenticate, adminRoles, deleteDecisionTypeHandler);

// Client Context Categories (custom + reserved) — same ordering constraint as above.
decisions.get("/decisions/context-categories", authenticate, listContextCategoriesHandler);
decisions.post("/decisions/context-categories", authenticate, adminRoles, createContextCategoryHandler);
decisions.put("/decisions/context-categories/:categoryId", authenticate, adminRoles, updateContextCategoryHandler);
decisions.delete("/decisions/context-categories/:categoryId", authenticate, adminRoles, deleteContextCategoryHandler);

decisions.post("/decisions/:id/review", authenticate, reviewerRoles, reviewDecisionHandler);
decisions.post("/decisions/:id/notes", authenticate, addDecisionNoteHandler);
decisions.get("/decisions/:id", authenticate, getDecisionHandler);

export { decisions as decisionsRoutes };
