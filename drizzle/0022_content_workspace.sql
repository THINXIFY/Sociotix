CREATE TABLE "content_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_folders_name_check" CHECK (char_length(btrim("content_folders"."name")) between 1 and 40)
);
--> statement-breakpoint
CREATE TABLE "content_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_media_name_check" CHECK (char_length(btrim("content_media"."name")) between 1 and 100),
	CONSTRAINT "content_media_mime_check" CHECK ("content_media"."mime" in ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "content_media_size_check" CHECK ("content_media"."size_bytes" between 1 and 5242880 and octet_length("content_media"."bytes") = "content_media"."size_bytes"),
	CONSTRAINT "content_media_dimensions_check" CHECK ("content_media"."width" between 1 and 12000 and "content_media"."height" between 1 and 12000)
);
--> statement-breakpoint
CREATE TABLE "content_post_media" (
	"post_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "content_post_media_post_id_media_id_pk" PRIMARY KEY("post_id","media_id")
);
--> statement-breakpoint
CREATE TABLE "content_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"hashtags" text[] DEFAULT '{}'::text[] NOT NULL,
	"providers" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_templates_check" CHECK (char_length(btrim("content_templates"."name")) between 1 and 60 and char_length("content_templates"."body") <= 5000 and cardinality("content_templates"."hashtags") <= 30)
);
--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "hashtags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "content_folders" ADD CONSTRAINT "content_folders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_media" ADD CONSTRAINT "content_media_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_post_media" ADD CONSTRAINT "content_post_media_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_post_media" ADD CONSTRAINT "content_post_media_media_id_content_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."content_media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_post_media" ADD CONSTRAINT "content_post_media_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_templates" ADD CONSTRAINT "content_templates_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_folders_name_idx" ON "content_folders" USING btree ("customer_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "content_media_customer_sha_idx" ON "content_media" USING btree ("customer_id","sha256");--> statement-breakpoint
CREATE INDEX "content_media_customer_idx" ON "content_media" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "content_post_media_media_idx" ON "content_post_media" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "content_templates_customer_idx" ON "content_templates" USING btree ("customer_id","updated_at");--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_folder_id_content_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."content_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "social_posts_folder_idx" ON "social_posts" USING btree ("folder_id");--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_content_check" CHECK (char_length("social_posts"."notes") <= 2000 and cardinality("social_posts"."hashtags") <= 30);