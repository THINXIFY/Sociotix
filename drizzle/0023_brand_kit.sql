CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"website" text,
	"industry" text DEFAULT '' NOT NULL,
	"logo_media_id" uuid,
	"cover_media_id" uuid,
	"primary_color" text,
	"secondary_color" text,
	"accent_color" text,
	"personality" text[] DEFAULT '{}'::text[] NOT NULL,
	"tone_of_voice" text DEFAULT '' NOT NULL,
	"audience" text DEFAULT '' NOT NULL,
	"demographics" text DEFAULT '' NOT NULL,
	"platforms" text[] DEFAULT '{}'::text[] NOT NULL,
	"keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"hashtags" text[] DEFAULT '{}'::text[] NOT NULL,
	"writing_guidelines" text DEFAULT '' NOT NULL,
	"preferred_phrases" text[] DEFAULT '{}'::text[] NOT NULL,
	"avoid_words" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_name_check" CHECK (char_length(btrim("brands"."name")) between 1 and 60),
	CONSTRAINT "brands_text_check" CHECK (char_length("brands"."description") <= 600 and char_length("brands"."industry") <= 60 and ("brands"."website" is null or char_length("brands"."website") <= 200) and char_length("brands"."tone_of_voice") <= 500 and char_length("brands"."audience") <= 1000 and char_length("brands"."demographics") <= 500 and char_length("brands"."writing_guidelines") <= 2000),
	CONSTRAINT "brands_colors_check" CHECK (("brands"."primary_color" is null or "brands"."primary_color" ~ '^#[0-9a-f]{6}$') and ("brands"."secondary_color" is null or "brands"."secondary_color" ~ '^#[0-9a-f]{6}$') and ("brands"."accent_color" is null or "brands"."accent_color" ~ '^#[0-9a-f]{6}$')),
	CONSTRAINT "brands_lists_check" CHECK (cardinality("brands"."personality") <= 8 and cardinality("brands"."keywords") <= 20 and cardinality("brands"."hashtags") <= 30 and cardinality("brands"."preferred_phrases") <= 20 and cardinality("brands"."avoid_words") <= 20 and cardinality("brands"."platforms") <= 6)
);
--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "brand_id" uuid;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_logo_media_id_content_media_id_fk" FOREIGN KEY ("logo_media_id") REFERENCES "public"."content_media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_cover_media_id_content_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."content_media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brands_name_idx" ON "brands" USING btree ("customer_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "brands_default_idx" ON "brands" USING btree ("customer_id") WHERE "brands"."is_default";--> statement-breakpoint
CREATE INDEX "brands_customer_idx" ON "brands" USING btree ("customer_id","updated_at");--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "social_posts_brand_idx" ON "social_posts" USING btree ("brand_id");