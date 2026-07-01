-- Restores the id/updated_at column defaults on client_decision_types and
-- client_context_categories that were accidentally dropped in
-- 20260617003757. Without them, the trg_client_seed_default_types trigger
-- (which inserts rows without specifying id/updated_at) fails with a
-- NOT NULL constraint violation on every new client creation.

ALTER TABLE "client_context_categories"
    ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
    ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "client_decision_types"
    ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
    ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
