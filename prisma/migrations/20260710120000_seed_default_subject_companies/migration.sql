-- Extends fn_seed_client_default_types() (see 20260701190000_recreate_client_seed_trigger)
-- to also seed a default set of subject companies (sources) for every new client, so the
-- Chrome extension has somewhere to match against immediately after signup instead of
-- requiring an admin to register sources by hand first.
--
-- Idempotent: CREATE OR REPLACE, ON CONFLICT DO NOTHING, matching the existing pattern.

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

DROP TRIGGER IF EXISTS trg_client_seed_default_types ON "clients";

CREATE TRIGGER trg_client_seed_default_types
    AFTER INSERT ON "clients"
    FOR EACH ROW
    EXECUTE FUNCTION fn_seed_client_default_types();

-- Backfill subject companies for clients that already existed before this migration.
INSERT INTO "subject_companies" ("client_id", "external_id", "name", "domain", "active", "updated_at")
SELECT c."id", v."external_id", v."name", v."domain", true, NOW()
FROM "clients" c
CROSS JOIN (VALUES
    ('figma.com',      'Figma',      'figma.com'),
    ('slack.com',      'Slack',      'slack.com'),
    ('salesforce.com', 'Salesforce', 'salesforce.com'),
    ('hubspot.com',    'HubSpot',    'hubspot.com'),
    ('jira.com',       'Jira',       'jira.com'),
    ('github.com',     'GitHub',     'github.com'),
    ('notion.so',      'Notion',     'notion.so'),
    ('zendesk.com',    'Zendesk',    'zendesk.com'),
    ('asana.com',      'Asana',      'asana.com'),
    ('intercom.com',   'Intercom',   'intercom.com'),
    ('stripe.com',     'Stripe',     'stripe.com'),
    ('zoom.us',        'Zoom',       'zoom.us')
) AS v("external_id", "name", "domain")
ON CONFLICT ("client_id", "external_id") DO NOTHING;
