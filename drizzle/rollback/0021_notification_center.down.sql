-- Rollback for 0021_notification_center (development and test only). Keeps every notification; removes de-duplication keys, the unread index and the category check.
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_kind_check";
DROP INDEX IF EXISTS "notifications_dedupe_idx";
DROP INDEX IF EXISTS "notifications_unread_idx";
ALTER TABLE "notifications" DROP COLUMN IF EXISTS "dedupe_key";
DELETE FROM drizzle.__drizzle_migrations WHERE id = (SELECT max(id) FROM drizzle.__drizzle_migrations);
