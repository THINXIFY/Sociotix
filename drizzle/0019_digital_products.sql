CREATE TABLE "digital_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "digital_categories_slug_check" CHECK ("digital_categories"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length("digital_categories"."slug") <= 60),
	CONSTRAINT "digital_categories_name_check" CHECK (length("digital_categories"."name") between 1 and 60),
	CONSTRAINT "digital_categories_reserved_check" CHECK ("digital_categories"."slug" not in ('social-templates', 'ai-prompts', 'web-templates', 'branding', 'ebooks', 'planners', 'ai-agents', 'creative-toolkits'))
);
--> statement-breakpoint
CREATE TABLE "digital_product_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"bytes" "bytea" NOT NULL,
	"sha256" text NOT NULL,
	"version" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "digital_product_files_mime_check" CHECK ("digital_product_files"."mime" in ('application/zip', 'application/pdf', 'application/epub+zip', 'image/png', 'image/jpeg', 'image/webp')),
	CONSTRAINT "digital_product_files_size_check" CHECK ("digital_product_files"."size_bytes" between 1 and 8388608 and octet_length("digital_product_files"."bytes") = "digital_product_files"."size_bytes"),
	CONSTRAINT "digital_product_files_name_check" CHECK (length("digital_product_files"."filename") between 1 and 160),
	CONSTRAINT "digital_product_files_version_check" CHECK (length("digital_product_files"."version") <= 40)
);
--> statement-breakpoint
CREATE TABLE "digital_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"short_description" text DEFAULT '' NOT NULL,
	"content" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category" text NOT NULL,
	"product_type" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pricing" text DEFAULT 'unset' NOT NULL,
	"price_cents" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"availability" text DEFAULT 'coming_soon' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"featured_image_id" uuid,
	"featured_image_alt" text DEFAULT '' NOT NULL,
	"gallery" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"includes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"highlights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"specifications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"compatibility" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"license_type" text DEFAULT '' NOT NULL,
	"usage_terms" text DEFAULT '' NOT NULL,
	"download_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
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
	CONSTRAINT "digital_products_slug_check" CHECK ("digital_products"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length("digital_products"."slug") <= 80),
	CONSTRAINT "digital_products_title_check" CHECK (length("digital_products"."title") between 1 and 160),
	CONSTRAINT "digital_products_category_check" CHECK ("digital_products"."category" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length("digital_products"."category") <= 60),
	CONSTRAINT "digital_products_pricing_check" CHECK ("digital_products"."pricing" in ('free', 'paid', 'unset')),
	CONSTRAINT "digital_products_price_check" CHECK (("digital_products"."pricing" = 'paid' and "digital_products"."price_cents" between 1 and 100000000) or ("digital_products"."pricing" <> 'paid' and "digital_products"."price_cents" is null)),
	CONSTRAINT "digital_products_currency_check" CHECK ("digital_products"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "digital_products_availability_check" CHECK ("digital_products"."availability" in ('coming_soon', 'available')),
	CONSTRAINT "digital_products_status_check" CHECK ("digital_products"."status" in ('draft', 'published', 'archived')),
	CONSTRAINT "digital_products_published_check" CHECK ("digital_products"."status" <> 'published' or "digital_products"."published_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "digital_categories" ADD CONSTRAINT "digital_categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_product_files" ADD CONSTRAINT "digital_product_files_product_id_digital_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."digital_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_product_files" ADD CONSTRAINT "digital_product_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_products" ADD CONSTRAINT "digital_products_featured_image_id_blog_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."blog_media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_products" ADD CONSTRAINT "digital_products_social_image_id_blog_media_id_fk" FOREIGN KEY ("social_image_id") REFERENCES "public"."blog_media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_products" ADD CONSTRAINT "digital_products_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_products" ADD CONSTRAINT "digital_products_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "digital_categories_slug_key" ON "digital_categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "digital_categories_name_key" ON "digital_categories" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "digital_product_files_product_idx" ON "digital_product_files" USING btree ("product_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "digital_products_slug_key" ON "digital_products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "digital_products_public_idx" ON "digital_products" USING btree ("status","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "digital_products_updated_idx" ON "digital_products" USING btree ("updated_at" DESC NULLS LAST);