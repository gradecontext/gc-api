-- ContextGrade: Browser Extension Layer
-- Adds: SourceApplication, ObservedEvent, DecisionNote, DecisionEntity
-- Modifies: decisions.subject_company_id → nullable

-- ============================================================
-- STEP 1: Make subject_company_id nullable on decisions
-- Enables decisions not tied to a company (design, engineering, support, hiring)
-- ============================================================

ALTER TABLE "decisions" ALTER COLUMN "subject_company_id" DROP NOT NULL;

-- ============================================================
-- STEP 2: source_applications
-- Registry of apps the extension monitors, per client
-- ============================================================

CREATE TABLE "source_applications" (
    "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
    "client_id"      INTEGER      NOT NULL,
    "name"           TEXT         NOT NULL,
    "slug"           VARCHAR(100) NOT NULL,
    "domain_pattern" TEXT,
    "active"         BOOLEAN      NOT NULL DEFAULT true,
    "settings"       JSONB        DEFAULT '{}',
    "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "source_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "source_applications_client_id_slug_key"
    ON "source_applications"("client_id", "slug");

CREATE INDEX "source_applications_client_id_idx"
    ON "source_applications"("client_id");

ALTER TABLE "source_applications"
    ADD CONSTRAINT "source_applications_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- STEP 3: observed_events
-- Raw pre-decision signal stream from the browser extension
-- ============================================================

CREATE TABLE "observed_events" (
    "id"                       UUID         NOT NULL DEFAULT gen_random_uuid(),
    "client_id"                INTEGER      NOT NULL,
    "source_app"               TEXT         NOT NULL,
    "source_application_id"    UUID,
    "event_type"               TEXT         NOT NULL,
    "source_url"               TEXT,
    "external_entity_id"       TEXT,
    "title"                    TEXT,
    "description"              TEXT,
    "occurred_by_user_id"      INTEGER,
    "raw_payload"              JSONB,
    "metadata"                 JSONB        DEFAULT '{}',
    "converted_to_decision_id" UUID,
    "occurred_at"              TIMESTAMPTZ(6) NOT NULL,
    "created_at"               TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observed_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "observed_events_client_id_idx"
    ON "observed_events"("client_id");

CREATE INDEX "observed_events_source_app_idx"
    ON "observed_events"("source_app");

CREATE INDEX "observed_events_event_type_idx"
    ON "observed_events"("event_type");

CREATE INDEX "observed_events_occurred_at_idx"
    ON "observed_events"("occurred_at");

CREATE INDEX "observed_events_client_id_source_app_idx"
    ON "observed_events"("client_id", "source_app");

CREATE INDEX "observed_events_converted_to_decision_id_idx"
    ON "observed_events"("converted_to_decision_id");

ALTER TABLE "observed_events"
    ADD CONSTRAINT "observed_events_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "observed_events"
    ADD CONSTRAINT "observed_events_source_application_id_fkey"
    FOREIGN KEY ("source_application_id") REFERENCES "source_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "observed_events"
    ADD CONSTRAINT "observed_events_occurred_by_user_id_fkey"
    FOREIGN KEY ("occurred_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "observed_events"
    ADD CONSTRAINT "observed_events_converted_to_decision_id_fkey"
    FOREIGN KEY ("converted_to_decision_id") REFERENCES "decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- STEP 4: decision_notes
-- Append-only informal reasoning attached to decisions
-- ============================================================

CREATE TABLE "decision_notes" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "decision_id" UUID NOT NULL,
    "author_id"   INTEGER,
    "content"     TEXT NOT NULL,
    "source_app"  TEXT,
    "source_url"  TEXT,
    "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "decision_notes_decision_id_idx"
    ON "decision_notes"("decision_id");

CREATE INDEX "decision_notes_author_id_idx"
    ON "decision_notes"("author_id");

ALTER TABLE "decision_notes"
    ADD CONSTRAINT "decision_notes_decision_id_fkey"
    FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "decision_notes"
    ADD CONSTRAINT "decision_notes_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- STEP 5: decision_entities
-- Generic artifact linking — Jira tickets, Figma files, GitHub PRs, etc.
-- ============================================================

CREATE TABLE "decision_entities" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "decision_id" UUID         NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id"   TEXT         NOT NULL,
    "metadata"    JSONB        DEFAULT '{}',
    "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_entities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "decision_entities_decision_id_idx"
    ON "decision_entities"("decision_id");

CREATE INDEX "decision_entities_entity_type_entity_id_idx"
    ON "decision_entities"("entity_type", "entity_id");

ALTER TABLE "decision_entities"
    ADD CONSTRAINT "decision_entities_decision_id_fkey"
    FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
