CREATE TABLE "blog_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mime" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"sha256" text NOT NULL,
	"source" text NOT NULL,
	"source_url" text,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_media_mime_check" CHECK ("blog_media"."mime" in ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "blog_media_source_check" CHECK ("blog_media"."source" in ('upload', 'url')),
	CONSTRAINT "blog_media_size_check" CHECK ("blog_media"."size_bytes" between 1 and 5242880 and octet_length("blog_media"."bytes") = "blog_media"."size_bytes"),
	CONSTRAINT "blog_media_dimensions_check" CHECK ("blog_media"."width" between 1 and 12000 and "blog_media"."height" between 1 and 12000)
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"content" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"author_kind" text DEFAULT 'organization' NOT NULL,
	"author_name" text DEFAULT 'Sociotix Team' NOT NULL,
	"featured_image_id" uuid,
	"featured_image_alt" text DEFAULT '' NOT NULL,
	"focus_keyword" text DEFAULT '' NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seo_title" text DEFAULT '' NOT NULL,
	"meta_description" text DEFAULT '' NOT NULL,
	"social_title" text DEFAULT '' NOT NULL,
	"social_description" text DEFAULT '' NOT NULL,
	"social_image_id" uuid,
	"published_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_posts_slug_check" CHECK ("blog_posts"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length("blog_posts"."slug") <= 80),
	CONSTRAINT "blog_posts_title_check" CHECK (length("blog_posts"."title") between 1 and 160),
	CONSTRAINT "blog_posts_category_check" CHECK ("blog_posts"."category" in ('social-media', 'ai-marketing', 'growth', 'automation', 'guides', 'tips')),
	CONSTRAINT "blog_posts_status_check" CHECK ("blog_posts"."status" in ('draft', 'published')),
	CONSTRAINT "blog_posts_author_kind_check" CHECK ("blog_posts"."author_kind" in ('organization', 'person')),
	CONSTRAINT "blog_posts_published_check" CHECK ("blog_posts"."status" <> 'published' or "blog_posts"."published_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "blog_slug_redirects" (
	"slug" text PRIMARY KEY NOT NULL,
	"post_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog_media" ADD CONSTRAINT "blog_media_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_featured_image_id_blog_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."blog_media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_social_image_id_blog_media_id_fk" FOREIGN KEY ("social_image_id") REFERENCES "public"."blog_media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_slug_redirects" ADD CONSTRAINT "blog_slug_redirects_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "blog_media_sha256_key" ON "blog_media" USING btree ("sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "blog_posts_public_idx" ON "blog_posts" USING btree ("status","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "blog_posts_updated_idx" ON "blog_posts" USING btree ("updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "blog_slug_redirects_post_idx" ON "blog_slug_redirects" USING btree ("post_id");