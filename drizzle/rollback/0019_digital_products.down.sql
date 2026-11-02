-- Rollback for 0019_digital_products (development and test only). Drops admin-created digital products, their files and custom categories.
DROP TABLE IF EXISTS digital_product_files;
DROP TABLE IF EXISTS digital_products;
DROP TABLE IF EXISTS digital_categories;
DELETE FROM drizzle.__drizzle_migrations WHERE id = (SELECT max(id) FROM drizzle.__drizzle_migrations);
