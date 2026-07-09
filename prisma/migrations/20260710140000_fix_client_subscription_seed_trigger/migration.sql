-- Same bug as 20260710130000, but for the OTHER client-insert trigger:
-- fn_seed_client_subscription() (added in 20260708120000_add_billing_subscriptions)
-- inserts into "client_subscriptions" without "id"/"updated_at", which used to
-- rely on a DB default that 20260708124853 dropped (Prisma's @default(uuid())
-- and @updatedAt are app-side only). This was the actual remaining cause of
-- "Null constraint violation on the fields: (id)" on new client creation even
-- after fixing fn_seed_client_default_types.

CREATE OR REPLACE FUNCTION fn_seed_client_subscription()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO "client_subscriptions" ("id", "client_id", "plan", "status", "updated_at")
    VALUES (gen_random_uuid(), NEW."id", 'FREE', 'ACTIVE', NOW())
    ON CONFLICT ("client_id") DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
