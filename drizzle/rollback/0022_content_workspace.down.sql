-- Rollback for 0022_content_workspace (development and test only). Drops the media library, templates and folders and the organisation columns on social_posts; the posts themselves are kept.
ALTER TABLE "social_posts" DROP CONSTRAINT IF EXISTS "social_posts_content_check";
ALTER TABLE "social_posts" DROP CONSTRAINT IF EXISTS "social_posts_folder_id_content_folders_id_fk";
DROP INDEX IF EXISTS "social_posts_folder_idx";
ALTER TABLE "social_posts" DROP COLUMN IF EXISTS "version";
ALTER TABLE "social_posts" DROP COLUMN IF EXISTS "notes";
ALTER TABLE "social_posts" DROP COLUMN IF EXISTS "hashtags";
ALTER TABLE "social_posts" DROP COLUMN IF EXISTS "folder_id";
ALTER TABLE "social_posts" DROP COLUMN IF EXISTS "archived_at";
ALTER TABLE "social_posts" DROP COLUMN IF EXISTS "favorite";
DROP TABLE IF EXISTS "content_post_media";
DROP TABLE IF EXISTS "content_templates";
DROP TABLE IF EXISTS "content_media";
DROP TABLE IF EXISTS "content_folders";
DELETE FROM drizzle.__drizzle_migrations WHERE id = (SELECT max(id) FROM drizzle.__drizzle_migrations);
