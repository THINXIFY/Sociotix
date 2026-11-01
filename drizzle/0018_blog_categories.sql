CREATE TABLE "blog_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_categories_slug_check" CHECK ("blog_categories"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length("blog_categories"."slug") <= 60),
	CONSTRAINT "blog_categories_name_check" CHECK (length("blog_categories"."name") between 1 and 60),
	CONSTRAINT "blog_categories_reserved_check" CHECK ("blog_categories"."slug" not in ('social-media', 'ai-marketing', 'growth', 'automation', 'guides', 'tips'))
);
--> statement-breakpoint
ALTER TABLE "blog_posts" DROP CONSTRAINT "blog_posts_category_check";--> statement-breakpoint
ALTER TABLE "blog_categories" ADD CONSTRAINT "blog_categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "blog_categories_slug_key" ON "blog_categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_categories_name_key" ON "blog_categories" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_category_check" CHECK ("blog_posts"."category" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length("blog_posts"."category") <= 60);