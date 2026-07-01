-- Re-creates fn_seed_client_default_types / trg_client_seed_default_types and
-- backfills any client missing its default rows.
--
-- Production's _prisma_migrations history shows 20260616000000_client_decision_types_categories
-- and 20260617003757 both recorded with applied_steps_count = 0 (the signature of
-- `prisma migrate resolve --applied`) — they were marked applied without their SQL
-- ever running there. The tables exist in prod, but fn_seed_client_default_types()
-- and trg_client_seed_default_types were never created, so every prod client has
-- zero rows in client_decision_types / client_context_categories.
--
-- This migration is idempotent (CREATE OR REPLACE, DROP TRIGGER IF EXISTS,
-- ON CONFLICT DO NOTHING) so it's safe to run anywhere, including environments
-- where the trigger already exists and is working correctly.

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
        (NEW."id", 'CUSTOM',           'Custom',           true)
    ON CONFLICT ("client_id", "decision_type") DO NOTHING;

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
        (NEW."id", 'CUSTOM',      'Custom',      true)
    ON CONFLICT ("client_id", "category") DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_client_seed_default_types ON "clients";

CREATE TRIGGER trg_client_seed_default_types
    AFTER INSERT ON "clients"
    FOR EACH ROW
    EXECUTE FUNCTION fn_seed_client_default_types();

-- Backfill clients created while the trigger was missing in production.
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
