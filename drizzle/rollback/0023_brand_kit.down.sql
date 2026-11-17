-- Rollback for 0023_brand_kit (development and test only). Drops brand profiles and the brand link on social_posts; posts and media are kept.
ALTER TABLE "social_posts" DROP CONSTRAINT IF EXISTS "social_posts_brand_id_brands_id_fk";
DROP INDEX IF EXISTS "social_posts_brand_idx";
ALTER TABLE "social_posts" DROP COLUMN IF EXISTS "brand_id";
DROP TABLE IF EXISTS "brands";
DELETE FROM drizzle.__drizzle_migrations WHERE id = (SELECT max(id) FROM drizzle.__drizzle_migrations);
