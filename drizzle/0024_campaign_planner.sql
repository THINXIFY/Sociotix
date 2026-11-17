CREATE TABLE "campaign_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"title" text NOT NULL,
	"due_date" date,
	"position" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_milestones_title_check" CHECK (char_length(btrim("campaign_milestones"."title")) between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "campaign_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"milestone_id" uuid,
	"title" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"due_date" date,
	"priority" text DEFAULT 'medium' NOT NULL,
	"completed_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_tasks_text_check" CHECK (char_length(btrim("campaign_tasks"."title")) between 1 and 140 and char_length("campaign_tasks"."notes") <= 1000),
	CONSTRAINT "campaign_tasks_priority_check" CHECK ("campaign_tasks"."priority" in ('low', 'medium', 'high'))
);
--> statement-breakpoint
CREATE TABLE "campaign_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"objective" text DEFAULT 'awareness' NOT NULL,
	"platforms" text[] DEFAULT '{}'::text[] NOT NULL,
	"structure" jsonb DEFAULT '{"milestones":[],"tasks":[]}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_templates_text_check" CHECK (char_length(btrim("campaign_templates"."name")) between 1 and 80 and char_length("campaign_templates"."description") <= 1000 and cardinality("campaign_templates"."platforms") <= 6),
	CONSTRAINT "campaign_templates_objective_check" CHECK ("campaign_templates"."objective" in ('awareness', 'engagement', 'traffic', 'leads', 'sales', 'launch', 'community', 'other'))
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"brand_id" uuid,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"objective" text DEFAULT 'awareness' NOT NULL,
	"platforms" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"start_date" date,
	"end_date" date,
	"budget_cents" bigint,
	"budget_currency" text DEFAULT 'USD' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_name_check" CHECK (char_length(btrim("campaigns"."name")) between 1 and 80),
	CONSTRAINT "campaigns_text_check" CHECK (char_length("campaigns"."description") <= 1000 and char_length("campaigns"."notes") <= 4000 and cardinality("campaigns"."platforms") <= 6),
	CONSTRAINT "campaigns_status_check" CHECK ("campaigns"."status" in ('draft', 'planned', 'active', 'completed', 'archived')),
	CONSTRAINT "campaigns_objective_check" CHECK ("campaigns"."objective" in ('awareness', 'engagement', 'traffic', 'leads', 'sales', 'launch', 'community', 'other')),
	CONSTRAINT "campaigns_dates_check" CHECK ("campaigns"."start_date" is null or "campaigns"."end_date" is null or "campaigns"."end_date" >= "campaigns"."start_date"),
	CONSTRAINT "campaigns_budget_check" CHECK (("campaigns"."budget_cents" is null or "campaigns"."budget_cents" between 0 and 100000000000) and "campaigns"."budget_currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "campaign_milestones" ADD CONSTRAINT "campaign_milestones_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_milestones" ADD CONSTRAINT "campaign_milestones_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_tasks" ADD CONSTRAINT "campaign_tasks_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_tasks" ADD CONSTRAINT "campaign_tasks_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_tasks" ADD CONSTRAINT "campaign_tasks_milestone_id_campaign_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."campaign_milestones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_templates" ADD CONSTRAINT "campaign_templates_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_milestones_campaign_idx" ON "campaign_milestones" USING btree ("campaign_id","position");--> statement-breakpoint
CREATE INDEX "campaign_milestones_customer_idx" ON "campaign_milestones" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "campaign_tasks_campaign_idx" ON "campaign_tasks" USING btree ("campaign_id","position");--> statement-breakpoint
CREATE INDEX "campaign_tasks_customer_idx" ON "campaign_tasks" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "campaign_tasks_milestone_idx" ON "campaign_tasks" USING btree ("milestone_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_templates_name_idx" ON "campaign_templates" USING btree ("customer_id",lower("name"));--> statement-breakpoint
CREATE INDEX "campaigns_customer_idx" ON "campaigns" USING btree ("customer_id","updated_at");--> statement-breakpoint
CREATE INDEX "campaigns_brand_idx" ON "campaigns" USING btree ("brand_id");--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "social_posts_campaign_idx" ON "social_posts" USING btree ("campaign_id");