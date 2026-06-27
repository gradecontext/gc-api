-- Enforce uniqueness on users.user_name.
-- NULLs remain unrestricted (Postgres treats them as distinct), so existing
-- users without a username are unaffected.
CREATE UNIQUE INDEX "users_user_name_key" ON "users"("user_name");
