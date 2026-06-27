-- ContextGrade: Collapse the DecisionContext "topic" layer.
-- Decisions previously pointed at an optional DecisionContext (a named topic,
-- e.g. "payment_onboarding") which itself belonged to a ClientContextCategory.
-- That topic layer had no creation API and was effectively dead weight — it
-- meant decisions could (and usually did) end up with no context at all,
-- making them invisible to AI report generation, which groups strictly by
-- category. This migration points decisions directly at their context
-- category, mirroring how decision_type already works.

-- ============================================================
-- STEP 1: Add the new column (nullable for now, to allow backfill)
-- ============================================================

ALTER TABLE "decisions" ADD COLUMN "context_category_id" UUID;

-- ============================================================
-- STEP 2: Backfill from existing decision_contexts, where set
-- ============================================================

UPDATE "decisions" d
SET "context_category_id" = dc."category_id"
FROM "decision_contexts" dc
WHERE dc."id" = d."context_id";

-- ============================================================
-- STEP 3: Backfill decisions with no prior context to each client's
-- reserved CUSTOM category, so no existing row is left NULL.
-- ============================================================

UPDATE "decisions" d
SET "context_category_id" = ccc."id"
FROM "client_context_categories" ccc
WHERE ccc."client_id" = d."client_id"
  AND ccc."category" = 'CUSTOM'
  AND d."context_category_id" IS NULL;

-- ============================================================
-- STEP 4: Enforce NOT NULL + FK + index
-- ============================================================

ALTER TABLE "decisions" ALTER COLUMN "context_category_id" SET NOT NULL;

ALTER TABLE "decisions"
    ADD CONSTRAINT "decisions_context_category_id_fkey"
    FOREIGN KEY ("context_category_id") REFERENCES "client_context_categories"("id") ON UPDATE CASCADE;

CREATE INDEX "decisions_client_id_context_category_id_idx"
    ON "decisions"("client_id", "context_category_id");

-- ============================================================
-- STEP 5: Drop the old context_id column/index/constraint
-- ============================================================

DROP INDEX IF EXISTS "decisions_client_id_context_id_idx";
ALTER TABLE "decisions" DROP CONSTRAINT IF EXISTS "decisions_context_id_fkey";
ALTER TABLE "decisions" DROP COLUMN "context_id";

-- ============================================================
-- STEP 6: Drop the now-unused decision_contexts table
-- ============================================================

DROP TABLE "decision_contexts";
