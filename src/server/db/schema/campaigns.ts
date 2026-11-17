import { sql } from "drizzle-orm";
import { bigint, check, date, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { CAMPAIGN_OBJECTIVES, CAMPAIGN_STATUSES, TASK_PRIORITIES, type TemplateStructure } from "../../../lib/campaign";
import { brands } from "./content";
import { createdAt, oneOf, ts, updatedAt } from "./helpers";
import { customers } from "./identity";

/*
 * Campaign Planner (CP-01). A campaign is a customer's own plan: milestones, tasks and links to their existing
 * drafts (social_posts.campaign_id). Nothing here publishes, schedules or spends anything. Every row belongs to
 * exactly one customer; milestones and tasks also carry customer_id so every query can filter by owner.
 */

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    /** Optional brand profile (BR-01); cleared, never deleted with, if the brand is removed. */
    brandId: uuid("brand_id").references(() => brands.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    objective: text("objective").notNull().default("awareness"),
    platforms: text("platforms").array().notNull().default(sql`'{}'::text[]`),
    status: text("status").notNull().default("draft"),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    /** Customer-entered planning budget in cents (nothing is spent or charged). */
    budgetCents: bigint("budget_cents", { mode: "number" }),
    budgetCurrency: text("budget_currency").notNull().default("USD"),
    notes: text("notes").notNull().default(""),
    /** Bumped on every edit so two tabs can't silently overwrite each other. */
    version: integer("version").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("campaigns_customer_idx").on(t.customerId, t.updatedAt),
    index("campaigns_brand_idx").on(t.brandId),
    check("campaigns_name_check", sql`char_length(btrim(${t.name})) between 1 and 80`),
    check("campaigns_text_check", sql`char_length(${t.description}) <= 1000 and char_length(${t.notes}) <= 4000 and cardinality(${t.platforms}) <= 6`),
    check("campaigns_status_check", oneOf(t.status, CAMPAIGN_STATUSES)),
    check("campaigns_objective_check", oneOf(t.objective, CAMPAIGN_OBJECTIVES)),
    check("campaigns_dates_check", sql`${t.startDate} is null or ${t.endDate} is null or ${t.endDate} >= ${t.startDate}`),
    check("campaigns_budget_check", sql`(${t.budgetCents} is null or ${t.budgetCents} between 0 and 100000000000) and ${t.budgetCurrency} ~ '^[A-Z]{3}$'`),
  ],
);

export const campaignMilestones = pgTable(
  "campaign_milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    dueDate: date("due_date", { mode: "string" }),
    position: integer("position").notNull().default(0),
    version: integer("version").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("campaign_milestones_campaign_idx").on(t.campaignId, t.position), index("campaign_milestones_customer_idx").on(t.customerId), check("campaign_milestones_title_check", sql`char_length(btrim(${t.title})) between 1 and 100`)],
);

export const campaignTasks = pgTable(
  "campaign_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    /** The milestone this task belongs to; the task stays (ungrouped) if the milestone is deleted. */
    milestoneId: uuid("milestone_id").references(() => campaignMilestones.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    notes: text("notes").notNull().default(""),
    dueDate: date("due_date", { mode: "string" }),
    priority: text("priority").notNull().default("medium"),
    completedAt: ts("completed_at"),
    position: integer("position").notNull().default(0),
    version: integer("version").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("campaign_tasks_campaign_idx").on(t.campaignId, t.position),
    index("campaign_tasks_customer_idx").on(t.customerId),
    index("campaign_tasks_milestone_idx").on(t.milestoneId),
    check("campaign_tasks_text_check", sql`char_length(btrim(${t.title})) between 1 and 140 and char_length(${t.notes}) <= 1000`),
    check("campaign_tasks_priority_check", oneOf(t.priority, TASK_PRIORITIES)),
  ],
);

/** Reusable structures saved by the customer. Independent copies: editing or deleting one never touches a campaign. */
export const campaignTemplates = pgTable(
  "campaign_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    objective: text("objective").notNull().default("awareness"),
    platforms: text("platforms").array().notNull().default(sql`'{}'::text[]`),
    structure: jsonb("structure").$type<TemplateStructure>().notNull().default({ milestones: [], tasks: [] }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("campaign_templates_name_idx").on(t.customerId, sql`lower(${t.name})`),
    check("campaign_templates_text_check", sql`char_length(btrim(${t.name})) between 1 and 80 and char_length(${t.description}) <= 1000 and cardinality(${t.platforms}) <= 6`),
    check("campaign_templates_objective_check", oneOf(t.objective, CAMPAIGN_OBJECTIVES)),
  ],
);
