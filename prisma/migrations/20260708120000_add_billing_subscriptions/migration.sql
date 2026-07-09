-- ============================================================
-- Migration: Seat-based subscription billing
--
-- 1. Consolidates the "which plan" concept into a single enum. The old
--    client_plan enum (FREE, STARTER, PROFESSIONAL, ENTERPRISE) is renamed
--    to plan_tier and remapped to the new billing tiers:
--      STARTER      -> GROWTH
--      PROFESSIONAL -> SCALE
--      FREE         -> FREE
--      ENTERPRISE   -> ENTERPRISE
--    plan_tier is used by clients.plan (now a denormalized mirror of the
--    client's ClientSubscription.plan, written only by the billing
--    service), and unchanged by leads.plan_interest / beta_access_list.plan_interest
--    (pre-signup "plan interest" signals, unrelated to live billing state).
--
-- 2. Adds client_subscriptions — the actual source of truth for billing,
--    Stripe references, seat counts, and billing cycle.
--
-- 3. Adds fn_seed_client_subscription / trg_client_seed_subscription,
--    mirroring the existing fn_seed_client_default_types /
--    trg_client_seed_default_types pattern: every new client automatically
--    gets a FREE/ACTIVE subscription row.
--
-- 4. Backfills a FREE subscription row for any existing client missing one.
-- ============================================================

-- ------------------------------------------------------------
-- STEP 1: client_plan -> plan_tier (rename + remap)
-- ------------------------------------------------------------

CREATE TYPE "plan_tier" AS ENUM ('FREE', 'GROWTH', 'SCALE', 'ENTERPRISE');

ALTER TABLE "clients" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "clients" ALTER COLUMN "plan" TYPE "plan_tier" USING (
  CASE "plan"::text
    WHEN 'STARTER' THEN 'GROWTH'
    WHEN 'PROFESSIONAL' THEN 'SCALE'
    WHEN 'FREE' THEN 'FREE'
    WHEN 'ENTERPRISE' THEN 'ENTERPRISE'
  END
)::"plan_tier";
ALTER TABLE "clients" ALTER COLUMN "plan" SET DEFAULT 'FREE';

ALTER TABLE "leads" ALTER COLUMN "plan_interest" TYPE "plan_tier" USING (
  CASE "plan_interest"::text
    WHEN 'STARTER' THEN 'GROWTH'
    WHEN 'PROFESSIONAL' THEN 'SCALE'
    WHEN 'FREE' THEN 'FREE'
    WHEN 'ENTERPRISE' THEN 'ENTERPRISE'
  END
)::"plan_tier";

ALTER TABLE "beta_access_list" ALTER COLUMN "plan_interest" TYPE "plan_tier" USING (
  CASE "plan_interest"::text
    WHEN 'STARTER' THEN 'GROWTH'
    WHEN 'PROFESSIONAL' THEN 'SCALE'
    WHEN 'FREE' THEN 'FREE'
    WHEN 'ENTERPRISE' THEN 'ENTERPRISE'
  END
)::"plan_tier";

DROP TYPE "client_plan";

-- ------------------------------------------------------------
-- STEP 2: client_subscriptions
-- ------------------------------------------------------------

CREATE TYPE "sub_status" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'TRIALING', 'PAUSED');
CREATE TYPE "billing_cycle" AS ENUM ('MONTHLY', 'ANNUAL');

CREATE TABLE "client_subscriptions" (
    "id"                     UUID            NOT NULL DEFAULT gen_random_uuid(),
    "client_id"              INTEGER         NOT NULL,
    "plan"                   "plan_tier"     NOT NULL DEFAULT 'FREE',
    "status"                 "sub_status"    NOT NULL DEFAULT 'ACTIVE',
    "stripe_customer_id"     TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_price_id"        TEXT,
    "seat_count"             INTEGER         NOT NULL DEFAULT 0,
    "billing_cycle"          "billing_cycle" NOT NULL DEFAULT 'MONTHLY',
    "current_period_start"   TIMESTAMPTZ(6),
    "current_period_end"     TIMESTAMPTZ(6),
    "cancel_at_period_end"   BOOLEAN         NOT NULL DEFAULT false,
    "trial_ends_at"          TIMESTAMPTZ(6),
    "created_at"             TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"             TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_subscriptions_client_id_key" ON "client_subscriptions"("client_id");
CREATE UNIQUE INDEX "client_subscriptions_stripe_customer_id_key" ON "client_subscriptions"("stripe_customer_id");
CREATE UNIQUE INDEX "client_subscriptions_stripe_subscription_id_key" ON "client_subscriptions"("stripe_subscription_id");

ALTER TABLE "client_subscriptions"
    ADD CONSTRAINT "client_subscriptions_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------------------------------
-- STEP 3: seed trigger (mirrors fn_seed_client_default_types)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_seed_client_subscription()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO "client_subscriptions" ("client_id", "plan", "status")
    VALUES (NEW."id", 'FREE', 'ACTIVE')
    ON CONFLICT ("client_id") DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_client_seed_subscription ON "clients";

CREATE TRIGGER trg_client_seed_subscription
    AFTER INSERT ON "clients"
    FOR EACH ROW
    EXECUTE FUNCTION fn_seed_client_subscription();

-- ------------------------------------------------------------
-- STEP 4: backfill FREE subscription for existing clients
-- ------------------------------------------------------------

INSERT INTO "client_subscriptions" ("client_id", "plan", "status")
SELECT c."id", 'FREE', 'ACTIVE'
FROM "clients" c
ON CONFLICT ("client_id") DO NOTHING;
