-- Expands the default (reserved) client_decision_types / client_context_categories
-- seeded on every new client, and adds two more default subject_companies.
-- Builds on fn_seed_client_default_types() from 20260710130000_fix_client_seed_trigger_missing_defaults.
--
-- New reserved decision types: POLICY_EXCEPTION, BUDGET_APPROVAL, VENDOR_SELECTION,
-- SCOPE_CHANGE, REFUND, TERMINATION.
-- New reserved context categories: CODING, DESIGNING, POLICY, LEGAL, MARKETING,
-- PRODUCT, FINANCE, OPERATIONS.
-- New default subject companies: confluence.com, canva.com.
--
-- Idempotent: CREATE OR REPLACE, ON CONFLICT DO NOTHING, matching the existing pattern.
-- id/updated_at are set explicitly (gen_random_uuid() / NOW()) because DB defaults for
-- those columns were dropped in 20260708124853 (see 20260710130000 for the full story).

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
        (gen_random_uuid(), NEW."id", 'POLICY_EXCEPTION', 'Policy Exception', true, NOW()),
        (gen_random_uuid(), NEW."id", 'BUDGET_APPROVAL',  'Budget Approval',  true, NOW()),
        (gen_random_uuid(), NEW."id", 'VENDOR_SELECTION', 'Vendor Selection', true, NOW()),
        (gen_random_uuid(), NEW."id", 'SCOPE_CHANGE',     'Scope Change',     true, NOW()),
        (gen_random_uuid(), NEW."id", 'REFUND',           'Refund',           true, NOW()),
        (gen_random_uuid(), NEW."id", 'TERMINATION',      'Termination',      true, NOW()),
        (gen_random_uuid(), NEW."id", 'CUSTOM',           'Custom',           true, NOW())
    ON CONFLICT ("client_id", "decision_type") DO NOTHING;

    INSERT INTO "client_context_categories" ("id", "client_id", "category", "label", "is_reserved", "updated_at")
    VALUES
        (gen_random_uuid(), NEW."id", 'PAYMENT',     'Payment',     true, NOW()),
        (gen_random_uuid(), NEW."id", 'ONBOARDING',  'Onboarding',  true, NOW()),
        (gen_random_uuid(), NEW."id", 'HIRING',      'Hiring',      true, NOW()),
        (gen_random_uuid(), NEW."id", 'COMPLIANCE',  'Compliance',  true, NOW()),
        (gen_random_uuid(), NEW."id", 'ENGINEERING', 'Engineering', true, NOW()),
        (gen_random_uuid(), NEW."id", 'CODING',      'Coding',      true, NOW()),
        (gen_random_uuid(), NEW."id", 'DESIGNING',   'Designing',   true, NOW()),
        (gen_random_uuid(), NEW."id", 'SALES',       'Sales',       true, NOW()),
        (gen_random_uuid(), NEW."id", 'MARKETING',   'Marketing',   true, NOW()),
        (gen_random_uuid(), NEW."id", 'PRODUCT',     'Product',     true, NOW()),
        (gen_random_uuid(), NEW."id", 'FINANCE',     'Finance',     true, NOW()),
        (gen_random_uuid(), NEW."id", 'OPERATIONS',  'Operations',  true, NOW()),
        (gen_random_uuid(), NEW."id", 'LEGAL',       'Legal',       true, NOW()),
        (gen_random_uuid(), NEW."id", 'POLICY',      'Policy',      true, NOW()),
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
        (NEW."id", 'zoom.us',        'Zoom',       'zoom.us',        true, NOW()),
        (NEW."id", 'confluence.com', 'Confluence', 'confluence.com', true, NOW()),
        (NEW."id", 'canva.com',      'Canva',      'canva.com',      true, NOW())
    ON CONFLICT ("client_id", "external_id") DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill the new reserved decision types for clients that already existed before this migration.
INSERT INTO "client_decision_types" ("id", "client_id", "decision_type", "label", "is_reserved", "updated_at")
SELECT gen_random_uuid(), c."id", v."decision_type", v."label", true, NOW()
FROM "clients" c
CROSS JOIN (VALUES
    ('POLICY_EXCEPTION', 'Policy Exception'),
    ('BUDGET_APPROVAL',  'Budget Approval'),
    ('VENDOR_SELECTION', 'Vendor Selection'),
    ('SCOPE_CHANGE',     'Scope Change'),
    ('REFUND',           'Refund'),
    ('TERMINATION',      'Termination')
) AS v("decision_type", "label")
ON CONFLICT ("client_id", "decision_type") DO NOTHING;

-- Backfill the new reserved context categories for clients that already existed before this migration.
INSERT INTO "client_context_categories" ("id", "client_id", "category", "label", "is_reserved", "updated_at")
SELECT gen_random_uuid(), c."id", v."category", v."label", true, NOW()
FROM "clients" c
CROSS JOIN (VALUES
    ('CODING',     'Coding'),
    ('DESIGNING',  'Designing'),
    ('MARKETING',  'Marketing'),
    ('PRODUCT',    'Product'),
    ('FINANCE',    'Finance'),
    ('OPERATIONS', 'Operations'),
    ('LEGAL',      'Legal'),
    ('POLICY',     'Policy')
) AS v("category", "label")
ON CONFLICT ("client_id", "category") DO NOTHING;

-- Backfill the new default subject companies for clients that already existed before this migration.
INSERT INTO "subject_companies" ("client_id", "external_id", "name", "domain", "active", "updated_at")
SELECT c."id", v."external_id", v."name", v."domain", true, NOW()
FROM "clients" c
CROSS JOIN (VALUES
    ('confluence.com', 'Confluence', 'confluence.com'),
    ('canva.com',      'Canva',      'canva.com')
) AS v("external_id", "name", "domain")
ON CONFLICT ("client_id", "external_id") DO NOTHING;
