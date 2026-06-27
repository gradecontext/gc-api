import { Hono } from "hono";
import {
  createDecisionHandler,
  reviewDecisionHandler,
  getDecisionHandler,
  listDecisionsHandler,
  addDecisionNoteHandler,
  listDecisionTypesHandler,
  createDecisionTypeHandler,
  updateDecisionTypeHandler,
  deleteDecisionTypeHandler,
  listContextCategoriesHandler,
  createContextCategoryHandler,
  updateContextCategoryHandler,
  deleteContextCategoryHandler,
  listSubjectCompaniesHandler,
  createSubjectCompanyHandler,
  updateSubjectCompanyHandler,
  deleteSubjectCompanyHandler,
} from "./decisions.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";

const decisions = new Hono();

// Reviewing a decision (approve/reject/override/escalate) is open to any active
// member of the organization — both ADMIN and STAFF can make/approve decisions.
const reviewerRoles = requireRole("ADMIN", "STAFF");
// Decision types & context categories are organization-wide taxonomy — admin-managed,
// per "Client admins can add unlimited custom types/categories" in the product spec.
const adminRoles = requireRole("ADMIN");

// Decisions
decisions.get("/decisions", authenticate, listDecisionsHandler);
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

// Subject Companies (Sources) — admin-curated domains the extension matches against
// to decide where to show its icon. Same ordering constraint as above.
decisions.get("/decisions/subject-companies", authenticate, listSubjectCompaniesHandler);
decisions.post("/decisions/subject-companies", authenticate, adminRoles, createSubjectCompanyHandler);
decisions.put("/decisions/subject-companies/:subjectCompanyId", authenticate, adminRoles, updateSubjectCompanyHandler);
decisions.delete("/decisions/subject-companies/:subjectCompanyId", authenticate, adminRoles, deleteSubjectCompanyHandler);

decisions.post("/decisions/:id/review", authenticate, reviewerRoles, reviewDecisionHandler);
decisions.post("/decisions/:id/notes", authenticate, addDecisionNoteHandler);
decisions.get("/decisions/:id", authenticate, getDecisionHandler);

export { decisions as decisionsRoutes };
