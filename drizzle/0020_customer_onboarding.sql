ALTER TABLE "customer_preferences" ADD COLUMN "interests" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_preferences" ADD COLUMN "platforms" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_preferences" ADD COLUMN "onboarding" text;--> statement-breakpoint
ALTER TABLE "customer_preferences" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_preferences" ADD CONSTRAINT "customer_preferences_onboarding_check" CHECK ("customer_preferences"."onboarding" is null or "customer_preferences"."onboarding" in ('completed', 'skipped', 'existing'));--> statement-breakpoint
ALTER TABLE "customer_preferences" ADD CONSTRAINT "customer_preferences_interests_check" CHECK (jsonb_typeof("customer_preferences"."interests") = 'array' and jsonb_array_length("customer_preferences"."interests") <= 5);--> statement-breakpoint
ALTER TABLE "customer_preferences" ADD CONSTRAINT "customer_preferences_platforms_check" CHECK (jsonb_typeof("customer_preferences"."platforms") = 'array' and jsonb_array_length("customer_preferences"."platforms") <= 20);--> statement-breakpoint
-- Customers who signed up before onboarding existed are never interrupted by it (they can still open it from Settings).
INSERT INTO "customer_preferences" ("customer_id", "onboarding") SELECT "id", 'existing' FROM "customers" ON CONFLICT ("customer_id") DO UPDATE SET "onboarding" = 'existing' WHERE "customer_preferences"."onboarding" IS NULL;
