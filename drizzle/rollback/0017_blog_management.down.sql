-- Rollback for 0017_blog_management (development and test only). Drops admin-written blog posts and their images.
DROP TABLE IF EXISTS blog_slug_redirects;
DROP TABLE IF EXISTS blog_posts;
DROP TABLE IF EXISTS blog_media;
DELETE FROM drizzle.__drizzle_migrations WHERE id = (SELECT max(id) FROM drizzle.__drizzle_migrations);
