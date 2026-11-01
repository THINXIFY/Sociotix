-- Rollback for 0018_blog_categories (development and test only). Posts in custom categories move to "Tips & Insights" first.
UPDATE blog_posts SET category = 'tips' WHERE category NOT IN ('social-media', 'ai-marketing', 'growth', 'automation', 'guides', 'tips');
ALTER TABLE blog_posts DROP CONSTRAINT IF EXISTS blog_posts_category_check;
ALTER TABLE blog_posts ADD CONSTRAINT blog_posts_category_check CHECK (category in ('social-media', 'ai-marketing', 'growth', 'automation', 'guides', 'tips'));
DROP TABLE IF EXISTS blog_categories;
DELETE FROM drizzle.__drizzle_migrations WHERE id = (SELECT max(id) FROM drizzle.__drizzle_migrations);
