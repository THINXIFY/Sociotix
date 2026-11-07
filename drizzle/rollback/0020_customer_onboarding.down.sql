-- Rollback for 0020_customer_onboarding (development and test only). Removes onboarding goals, platforms and completion state; other preferences are kept.
ALTER TABLE "customer_preferences" DROP CONSTRAINT IF EXISTS "customer_preferences_platforms_check";
ALTER TABLE "customer_preferences" DROP CONSTRAINT IF EXISTS "customer_preferences_interests_check";
ALTER TABLE "customer_preferences" DROP CONSTRAINT IF EXISTS "customer_preferences_onboarding_check";
ALTER TABLE "customer_preferences" DROP COLUMN IF EXISTS "onboarded_at";
ALTER TABLE "customer_preferences" DROP COLUMN IF EXISTS "onboarding";
ALTER TABLE "customer_preferences" DROP COLUMN IF EXISTS "platforms";
ALTER TABLE "customer_preferences" DROP COLUMN IF EXISTS "interests";
DELETE FROM drizzle.__drizzle_migrations WHERE id = (SELECT max(id) FROM drizzle.__drizzle_migrations);
