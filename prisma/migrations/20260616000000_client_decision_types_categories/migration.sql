-- ContextGrade: Client-scoped Decision Types and Context Categories
-- Converts DecisionType and ContextCategory from shared Postgres enums
-- to per-client tables. Defaults are seeded for all existing clients here,
-- and a trigger fires on every future INSERT INTO clients to seed them automatically.

-- ============================================================
-- STEP 1: client_decision_types
-- ============================================================

CREATE TABLE "client_decision_types" (
    "id"            UUID            NOT NULL DEFAULT gen_random_uuid(),
    "client_id"     INTEGER         NOT NULL,
    "decision_type" VARCHAR(100)    NOT NULL,
    "label"         TEXT,
    "is_reserved"   BOOLEAN         NOT NULL DEFAULT false,
    "active"        BOOLEAN         NOT NULL DEFAULT true,
    "created_at"    TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_decision_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_decision_types_client_id_decision_type_key"
    ON "client_decision_types"("client_id", "decision_type");

CREATE INDEX "client_decision_types_client_id_idx"
    ON "client_decision_types"("client_id");

ALTER TABLE "client_decision_types"
    ADD CONSTRAINT "client_decision_types_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- STEP 2: client_context_categories
-- ============================================================

CREATE TABLE "client_context_categories" (
    "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
    "client_id"   INTEGER         NOT NULL,
    "category"    VARCHAR(100)    NOT NULL,
    "label"       TEXT,
    "is_reserved" BOOLEAN         NOT NULL DEFAULT false,
    "active"      BOOLEAN         NOT NULL DEFAULT true,
    "created_at"  TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_context_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_context_categories_client_id_category_key"
    ON "client_context_categories"("client_id", "category");

CREATE INDEX "client_context_categories_client_id_idx"
    ON "client_context_categories"("client_id");

ALTER TABLE "client_context_categories"
    ADD CONSTRAINT "client_context_categories_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- STEP 3: Seed reserved defaults for all existing clients
-- ============================================================

INSERT INTO "client_decision_types" ("client_id", "decision_type", "label", "is_reserved")
SELECT c."id", v."decision_type", v."label", true
FROM "clients" c
CROSS JOIN (VALUES
    ('DISCOUNT',         'Discount'),
    ('ONBOARDING',       'Onboarding'),
    ('PAYMENT_TERMS',    'Payment Terms'),
    ('CREDIT_EXTENSION', 'Credit Extension'),
    ('PARTNERSHIP',      'Partnership'),
    ('RENEWAL',          'Renewal'),
    ('ESCALATION',       'Escalation'),
    ('CUSTOM',           'Custom')
) AS v("decision_type", "label")
ON CONFLICT ("client_id", "decision_type") DO NOTHING;

INSERT INTO "client_context_categories" ("client_id", "category", "label", "is_reserved")
SELECT c."id", v."category", v."label", true
FROM "clients" c
CROSS JOIN (VALUES
    ('PAYMENT',     'Payment'),
    ('ONBOARDING',  'Onboarding'),
    ('HIRING',      'Hiring'),
    ('COMPLIANCE',  'Compliance'),
    ('ENGINEERING', 'Engineering'),
    ('SALES',       'Sales'),
    ('PARTNERSHIP', 'Partnership'),
    ('SECURITY',    'Security'),
    ('CUSTOM',      'Custom')
) AS v("category", "label")
ON CONFLICT ("client_id", "category") DO NOTHING;

-- ============================================================
-- STEP 4: Migrate decisions.decision_type enum → FK
-- ============================================================

ALTER TABLE "decisions" ADD COLUMN "decision_type_id" UUID;

-- Populate FK from current enum string values (cast enum → text for join)
UPDATE "decisions" d
SET "decision_type_id" = cdt."id"
FROM "client_decision_types" cdt
WHERE cdt."client_id" = d."client_id"
  AND cdt."decision_type" = d."decision_type"::TEXT;

ALTER TABLE "decisions" ALTER COLUMN "decision_type_id" SET NOT NULL;

ALTER TABLE "decisions"
    ADD CONSTRAINT "decisions_decision_type_id_fkey"
    FOREIGN KEY ("decision_type_id") REFERENCES "client_decision_types"("id") ON UPDATE CASCADE;

CREATE INDEX "decisions_decision_type_id_idx"
    ON "decisions"("decision_type_id");

CREATE INDEX "decisions_client_id_decision_type_id_idx"
    ON "decisions"("client_id", "decision_type_id");

-- Drop old enum column and its index
DROP INDEX IF EXISTS "decisions_client_id_decision_type_idx";
ALTER TABLE "decisions" DROP COLUMN "decision_type";

-- ============================================================
-- STEP 5: Migrate decision_contexts.category enum → FK
-- ============================================================

ALTER TABLE "decision_contexts" ADD COLUMN "category_id" UUID;

UPDATE "decision_contexts" dc
SET "category_id" = ccc."id"
FROM "client_context_categories" ccc
WHERE ccc."client_id" = dc."client_id"
  AND ccc."category" = dc."category"::TEXT;

ALTER TABLE "decision_contexts" ALTER COLUMN "category_id" SET NOT NULL;

ALTER TABLE "decision_contexts"
    ADD CONSTRAINT "decision_contexts_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "client_context_categories"("id") ON UPDATE CASCADE;

ALTER TABLE "decision_contexts" DROP COLUMN "category";

-- ============================================================
-- STEP 6: Drop the now-unused Postgres enum types
-- ============================================================

DROP TYPE IF EXISTS "decision_type";
DROP TYPE IF EXISTS "context_category";

-- ============================================================
-- STEP 7: Trigger — seed defaults whenever a new client is created
-- ============================================================

CREATE OR REPLACE FUNCTION fn_seed_client_default_types()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO "client_decision_types" ("client_id", "decision_type", "label", "is_reserved")
    VALUES
        (NEW."id", 'DISCOUNT',         'Discount',         true),
        (NEW."id", 'ONBOARDING',       'Onboarding',       true),
        (NEW."id", 'PAYMENT_TERMS',    'Payment Terms',    true),
        (NEW."id", 'CREDIT_EXTENSION', 'Credit Extension', true),
        (NEW."id", 'PARTNERSHIP',      'Partnership',      true),
        (NEW."id", 'RENEWAL',          'Renewal',          true),
        (NEW."id", 'ESCALATION',       'Escalation',       true),
        (NEW."id", 'CUSTOM',           'Custom',           true);

    INSERT INTO "client_context_categories" ("client_id", "category", "label", "is_reserved")
    VALUES
        (NEW."id", 'PAYMENT',     'Payment',     true),
        (NEW."id", 'ONBOARDING',  'Onboarding',  true),
        (NEW."id", 'HIRING',      'Hiring',      true),
        (NEW."id", 'COMPLIANCE',  'Compliance',  true),
        (NEW."id", 'ENGINEERING', 'Engineering', true),
        (NEW."id", 'SALES',       'Sales',       true),
        (NEW."id", 'PARTNERSHIP', 'Partnership', true),
        (NEW."id", 'SECURITY',    'Security',    true),
        (NEW."id", 'CUSTOM',      'Custom',      true);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_client_seed_default_types
    AFTER INSERT ON "clients"
    FOR EACH ROW
    EXECUTE FUNCTION fn_seed_client_default_types();
