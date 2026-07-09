-- Fixes fn_seed_client_default_types(): new client creation started failing with
-- "Null constraint violation on the fields: (id)" on POST /clients.
--
-- Root cause: "id" (String @default(uuid())) and "updated_at" (@updatedAt) on
-- client_decision_types / client_context_categories are Prisma-level (app-side)
-- defaults only — they were never DB defaults. A prior migration
-- (20260708124853) ran `ALTER COLUMN "id" DROP DEFAULT` / `... "updated_at" DROP
-- DEFAULT` on these tables to match schema.prisma's declared (lack of) DB
-- defaults. That's correct for normal Prisma-ORM inserts (which always send id
-- and updated_at explicitly), but this trigger inserts via raw SQL and relied on
-- the DB default existing — so every INSERT ... trg_client_seed_default_types
-- fires on `INSERT INTO clients` and now fails with a NOT NULL violation, which
-- aborts the whole client creation.
--
-- Fix: generate "id" with gen_random_uuid() and set "updated_at" explicitly in
-- the trigger's own inserts. subject_companies is unaffected (its "id" is a
-- serial/autoincrement column with a live DB sequence default); its
-- "updated_at" was already set explicitly when it was added in
-- 20260710120000_seed_default_subject_companies.

CREATE OR REPLACE FUNCTION fn_seed_client_default_types()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO "client_decision_types" ("id", "client_id", "decision_type", "label", "is_reserved", "updated_at")
    VALUES
        (gen_random_uuid(), NEW."id", 'DISCOUNT',         'Discount',         true, NOW()),
        (gen_random_uuid(), NEW."id", 'ONBOARDING',       'Onboarding',       true, NOW()),
        (gen_random_uuid(), NEW."id", 'PAYMENT_TERMS',    'Payment Terms',    true, NOW()),
        (gen_random_uuid(), NEW."id", 'CREDIT_EXTENSION', 'Credit Extension', true, NOW()),
        (gen_random_uuid(), NEW."id", 'PARTNERSHIP',      'Partnership',      true, NOW()),
        (gen_random_uuid(), NEW."id", 'RENEWAL',          'Renewal',          true, NOW()),
        (gen_random_uuid(), NEW."id", 'ESCALATION',       'Escalation',       true, NOW()),
        (gen_random_uuid(), NEW."id", 'CUSTOM',           'Custom',           true, NOW())
    ON CONFLICT ("client_id", "decision_type") DO NOTHING;

    INSERT INTO "client_context_categories" ("id", "client_id", "category", "label", "is_reserved", "updated_at")
    VALUES
        (gen_random_uuid(), NEW."id", 'PAYMENT',     'Payment',     true, NOW()),
        (gen_random_uuid(), NEW."id", 'ONBOARDING',  'Onboarding',  true, NOW()),
        (gen_random_uuid(), NEW."id", 'HIRING',      'Hiring',      true, NOW()),
        (gen_random_uuid(), NEW."id", 'COMPLIANCE',  'Compliance',  true, NOW()),
        (gen_random_uuid(), NEW."id", 'ENGINEERING', 'Engineering', true, NOW()),
        (gen_random_uuid(), NEW."id", 'SALES',       'Sales',       true, NOW()),
        (gen_random_uuid(), NEW."id", 'PARTNERSHIP', 'Partnership', true, NOW()),
        (gen_random_uuid(), NEW."id", 'SECURITY',    'Security',    true, NOW()),
        (gen_random_uuid(), NEW."id", 'CUSTOM',      'Custom',      true, NOW())
    ON CONFLICT ("client_id", "category") DO NOTHING;

    INSERT INTO "subject_companies" ("client_id", "external_id", "name", "domain", "active", "updated_at")
    VALUES
        (NEW."id", 'figma.com',      'Figma',      'figma.com',      true, NOW()),
        (NEW."id", 'slack.com',      'Slack',      'slack.com',      true, NOW()),
        (NEW."id", 'salesforce.com', 'Salesforce', 'salesforce.com', true, NOW()),
        (NEW."id", 'hubspot.com',    'HubSpot',    'hubspot.com',    true, NOW()),
        (NEW."id", 'jira.com',       'Jira',       'jira.com',       true, NOW()),
        (NEW."id", 'github.com',     'GitHub',     'github.com',     true, NOW()),
        (NEW."id", 'notion.so',      'Notion',     'notion.so',      true, NOW()),
        (NEW."id", 'zendesk.com',    'Zendesk',    'zendesk.com',    true, NOW()),
        (NEW."id", 'asana.com',      'Asana',      'asana.com',      true, NOW()),
        (NEW."id", 'intercom.com',   'Intercom',   'intercom.com',   true, NOW()),
        (NEW."id", 'stripe.com',     'Stripe',     'stripe.com',     true, NOW()),
        (NEW."id", 'zoom.us',        'Zoom',       'zoom.us',        true, NOW())
    ON CONFLICT ("client_id", "external_id") DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
