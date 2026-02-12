-- CreateEnum
CREATE TYPE "tenant_plan" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('OWNER', 'ADMIN', 'APPROVER', 'VIEWER');

-- CreateEnum
CREATE TYPE "company_size" AS ENUM ('MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE', 'MEGA');

-- CreateEnum
CREATE TYPE "deal_stage" AS ENUM ('OPEN', 'WON', 'LOST', 'STALLED');

-- CreateEnum
CREATE TYPE "context_category" AS ENUM ('PAYMENT', 'ONBOARDING', 'HIRING', 'COMPLIANCE', 'ENGINEERING', 'SALES', 'PARTNERSHIP', 'SECURITY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "decision_type" AS ENUM ('DISCOUNT', 'ONBOARDING', 'PAYMENT_TERMS', 'CREDIT_EXTENSION', 'PARTNERSHIP', 'RENEWAL', 'ESCALATION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "decision_status" AS ENUM ('PROPOSED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'OVERRIDDEN', 'EXPIRED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "decision_confidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "decision_urgency" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "override_action" AS ENUM ('APPROVED', 'REJECTED', 'ESCALATED', 'MODIFIED');

-- CreateEnum
CREATE TYPE "outcome_type" AS ENUM ('PAID_ON_TIME', 'PAID_LATE', 'CHURNED', 'FRAUD', 'EXPANDED', 'DOWNGRADED', 'DEFAULTED', 'POSITIVE', 'NEGATIVE', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "relationship_type" AS ENUM ('PRECEDENT', 'SIMILAR_CASE', 'POLICY_EXCEPTION', 'CONTRADICTS', 'SUPPORTS', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "source_type" AS ENUM ('REDDIT', 'TWITTER', 'G2', 'TRUSTPILOT', 'NEWS', 'GOOGLE_SEARCH', 'WEBSITE', 'LINKEDIN', 'CRUNCHBASE', 'COURT_RECORDS', 'FINANCIAL_FILINGS', 'GLASSDOOR', 'GITHUB', 'CUSTOM');

-- CreateEnum
CREATE TYPE "webhook_event_type" AS ENUM ('COMPANY_CREATED', 'COMPANY_UPDATED', 'DEAL_CREATED', 'DEAL_UPDATED', 'DISCOUNT_REQUESTED');

-- CreateEnum
CREATE TYPE "webhook_event_status" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "api_key" TEXT,
    "webhook_secret" TEXT,
    "plan" "tenant_plan" NOT NULL DEFAULT 'FREE',
    "settings" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "user_role" NOT NULL DEFAULT 'VIEWER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_companies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "industry" TEXT,
    "country" TEXT,
    "size" "company_size",
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subject_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" UUID NOT NULL,
    "subject_company_id" UUID NOT NULL,
    "crm_deal_id" TEXT,
    "amount" DECIMAL(19,2),
    "currency" VARCHAR(3) DEFAULT 'USD',
    "discount_requested" DECIMAL(5,2),
    "stage" "deal_stage" DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_contexts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "context_category" NOT NULL DEFAULT 'CUSTOM',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "decision_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "subject_company_id" UUID NOT NULL,
    "deal_id" UUID,
    "context_id" UUID,
    "decision_type" "decision_type" NOT NULL,
    "status" "decision_status" NOT NULL DEFAULT 'PROPOSED',
    "urgency" "decision_urgency" NOT NULL DEFAULT 'NORMAL',
    "recommended_action" TEXT,
    "recommended_confidence" "decision_confidence",
    "suggested_conditions" JSONB,
    "final_action" TEXT,
    "decided_by" UUID,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "decided_at" TIMESTAMPTZ(6),

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_context_snapshots" (
    "id" UUID NOT NULL,
    "decision_id" UUID NOT NULL,
    "signals" JSONB NOT NULL,
    "policies" JSONB,
    "agent_rationale" TEXT,
    "agent_model" TEXT,
    "processing_time_ms" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "decision_context_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_human_overrides" (
    "id" UUID NOT NULL,
    "decision_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "override_action" "override_action" NOT NULL,
    "override_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "decision_human_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_outcomes" (
    "id" UUID NOT NULL,
    "decision_id" UUID NOT NULL,
    "user_id" UUID,
    "outcome_type" "outcome_type" NOT NULL,
    "notes" TEXT,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "decision_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_links" (
    "id" UUID NOT NULL,
    "from_decision_id" UUID NOT NULL,
    "to_decision_id" UUID NOT NULL,
    "relationship_type" "relationship_type" NOT NULL,
    "confidence" DECIMAL(3,2),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "decision_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_sources" (
    "id" UUID NOT NULL,
    "decision_id" UUID NOT NULL,
    "source_type" "source_type" NOT NULL,
    "source_url" TEXT,
    "raw_data" JSONB,
    "reliability" DECIMAL(3,2),
    "extracted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "external_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "external_event_id" TEXT,
    "event_type" "webhook_event_type" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "webhook_event_status" NOT NULL DEFAULT 'RECEIVED',
    "processed_at" TIMESTAMPTZ(6),
    "error" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_api_key_key" ON "tenants"("api_key");

-- CreateIndex
CREATE INDEX "tenants_slug_idx" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "subject_companies_tenant_id_idx" ON "subject_companies"("tenant_id");

-- CreateIndex
CREATE INDEX "subject_companies_external_id_idx" ON "subject_companies"("external_id");

-- CreateIndex
CREATE INDEX "subject_companies_tenant_id_domain_idx" ON "subject_companies"("tenant_id", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "subject_companies_tenant_id_external_id_key" ON "subject_companies"("tenant_id", "external_id");

-- CreateIndex
CREATE INDEX "deals_subject_company_id_idx" ON "deals"("subject_company_id");

-- CreateIndex
CREATE INDEX "deals_crm_deal_id_idx" ON "deals"("crm_deal_id");

-- CreateIndex
CREATE INDEX "decision_contexts_tenant_id_idx" ON "decision_contexts"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "decision_contexts_tenant_id_key_key" ON "decision_contexts"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "decisions_tenant_id_idx" ON "decisions"("tenant_id");

-- CreateIndex
CREATE INDEX "decisions_subject_company_id_idx" ON "decisions"("subject_company_id");

-- CreateIndex
CREATE INDEX "decisions_tenant_id_status_idx" ON "decisions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "decisions_tenant_id_decision_type_idx" ON "decisions"("tenant_id", "decision_type");

-- CreateIndex
CREATE INDEX "decisions_tenant_id_context_id_idx" ON "decisions"("tenant_id", "context_id");

-- CreateIndex
CREATE INDEX "decisions_created_at_idx" ON "decisions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "decision_context_snapshots_decision_id_key" ON "decision_context_snapshots"("decision_id");

-- CreateIndex
CREATE INDEX "decision_human_overrides_decision_id_idx" ON "decision_human_overrides"("decision_id");

-- CreateIndex
CREATE INDEX "decision_human_overrides_user_id_idx" ON "decision_human_overrides"("user_id");

-- CreateIndex
CREATE INDEX "decision_outcomes_decision_id_idx" ON "decision_outcomes"("decision_id");

-- CreateIndex
CREATE INDEX "decision_outcomes_outcome_type_idx" ON "decision_outcomes"("outcome_type");

-- CreateIndex
CREATE INDEX "decision_links_from_decision_id_idx" ON "decision_links"("from_decision_id");

-- CreateIndex
CREATE INDEX "decision_links_to_decision_id_idx" ON "decision_links"("to_decision_id");

-- CreateIndex
CREATE UNIQUE INDEX "decision_links_from_decision_id_to_decision_id_relationship_key" ON "decision_links"("from_decision_id", "to_decision_id", "relationship_type");

-- CreateIndex
CREATE INDEX "external_sources_decision_id_idx" ON "external_sources"("decision_id");

-- CreateIndex
CREATE INDEX "external_sources_source_type_idx" ON "external_sources"("source_type");

-- CreateIndex
CREATE INDEX "policies_tenant_id_idx" ON "policies"("tenant_id");

-- CreateIndex
CREATE INDEX "policies_tenant_id_active_idx" ON "policies"("tenant_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_external_event_id_key" ON "webhook_events"("external_event_id");

-- CreateIndex
CREATE INDEX "webhook_events_tenant_id_idx" ON "webhook_events"("tenant_id");

-- CreateIndex
CREATE INDEX "webhook_events_status_idx" ON "webhook_events"("status");

-- CreateIndex
CREATE INDEX "webhook_events_external_event_id_idx" ON "webhook_events"("external_event_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_companies" ADD CONSTRAINT "subject_companies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_subject_company_id_fkey" FOREIGN KEY ("subject_company_id") REFERENCES "subject_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_contexts" ADD CONSTRAINT "decision_contexts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_subject_company_id_fkey" FOREIGN KEY ("subject_company_id") REFERENCES "subject_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_context_id_fkey" FOREIGN KEY ("context_id") REFERENCES "decision_contexts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_context_snapshots" ADD CONSTRAINT "decision_context_snapshots_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_human_overrides" ADD CONSTRAINT "decision_human_overrides_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_human_overrides" ADD CONSTRAINT "decision_human_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_outcomes" ADD CONSTRAINT "decision_outcomes_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_outcomes" ADD CONSTRAINT "decision_outcomes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_links" ADD CONSTRAINT "decision_links_from_decision_id_fkey" FOREIGN KEY ("from_decision_id") REFERENCES "decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_links" ADD CONSTRAINT "decision_links_to_decision_id_fkey" FOREIGN KEY ("to_decision_id") REFERENCES "decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_sources" ADD CONSTRAINT "external_sources_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
