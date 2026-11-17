-- Rollback for 0024_campaign_planner (development and test only). Drops campaigns, their milestones, tasks and templates and the campaign link on social_posts; posts are kept.
ALTER TABLE "social_posts" DROP CONSTRAINT IF EXISTS "social_posts_campaign_id_campaigns_id_fk";
DROP INDEX IF EXISTS "social_posts_campaign_idx";
ALTER TABLE "social_posts" DROP COLUMN IF EXISTS "campaign_id";
DROP TABLE IF EXISTS "campaign_tasks";
DROP TABLE IF EXISTS "campaign_milestones";
DROP TABLE IF EXISTS "campaign_templates";
DROP TABLE IF EXISTS "campaigns";
DELETE FROM drizzle.__drizzle_migrations WHERE id = (SELECT max(id) FROM drizzle.__drizzle_migrations);
