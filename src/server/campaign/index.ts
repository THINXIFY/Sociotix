import "server-only";
import { and, asc, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  BUDGET_CURRENCIES,
  BUDGET_MAX_CENTS,
  CAMPAIGN_DESCRIPTION_MAX,
  CAMPAIGN_NAME_MAX,
  CAMPAIGN_NOTES_MAX,
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_STATUSES,
  CAMPAIGN_TEMPLATES_MAX,
  CAMPAIGNS_MAX,
  dueFrom,
  isDate,
  LINK_MAX,
  MILESTONE_TITLE_MAX,
  MILESTONES_MAX,
  milestoneProgress,
  STARTER_IDS,
  STARTER_PLANS,
  structureOf,
  TASK_NOTES_MAX,
  TASK_PRIORITIES,
  TASK_TITLE_MAX,
  TASKS_MAX,
  type BudgetCurrency,
  type CampaignObjective,
  type CampaignStatus,
  type CampaignSummary,
  type CampaignTemplateView,
  type CampaignView,
  type TaskPriority,
  type TemplateStructure,
} from "@/lib/campaign";
import { isSocialProvider, SOCIAL_PROVIDER_IDS } from "@/lib/social/platforms";
import { hit } from "../auth/rate-limit";
import type { Db, Executor } from "../db/client";
import { brands, campaignMilestones, campaignTasks, campaignTemplates, campaigns, socialPosts } from "../db/schema";
import { AppError, errors, pgErrorOf } from "../errors";

/**
 * Campaign Planner (CP-01). Every function takes the signed-in customer's id and only reads or changes that
 * customer's rows; anything owned by someone else is "not found". Campaigns organise existing drafts by linking
 * them (social_posts.campaign_id): content is never copied, and deleting or unlinking never deletes a draft.
 * Statuses are the customer's own planning labels; nothing here publishes, schedules, advertises or spends.
 */

const isUuid = (s: string) => z.string().uuid().safeParse(s).success;

async function limitWrites(db: Executor, customerId: string) {
  const r = await hit(db, "campaignWrites", customerId, { limit: 600, windowSeconds: 3600 });
  if (!r.ok) throw new AppError("RATE_LIMITED", "You've made a lot of changes in a short time. Please wait a few minutes.");
}

function mapError(e: unknown): never {
  const pg = pgErrorOf(e);
  if (pg?.code === "23505" && pg.constraint === "campaign_templates_name_idx") throw errors.conflict("You already have a template with that name. Choose a different name.");
  if (pg?.code === "22P05") throw new AppError("VALIDATION_FAILED", "This text contains characters this server's database can't store yet.");
  throw e;
}

/** Runs a write and turns database errors into friendly ones. */
async function guarded<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AppError || e instanceof z.ZodError) throw e;
    mapError(e);
  }
}

/* -------------------------------------------------------------------------- */
/*  Input                                                                     */
/* -------------------------------------------------------------------------- */

const oneLine = (s: string) => s.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
const multiLine = (s: string) =>
  s
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
const line = (max: number, what: string) => z.string().transform(oneLine).refine((s) => Array.from(s).length <= max, `${what} can be up to ${max} characters.`);
const required = (max: number, what: string, missing: string) => line(max, what).refine((s) => s.length >= 1, missing);
const para = (max: number, what: string) => z.string().transform(multiLine).refine((s) => Array.from(s).length <= max, `${what} can be up to ${max.toLocaleString("en-US")} characters.`);
const day = z
  .string()
  .nullable()
  .transform((v, ctx) => {
    if (v === null || !v.trim()) return null;
    if (!isDate(v.trim())) ctx.addIssue({ code: "custom", message: "Enter a valid date." });
    return v.trim();
  });

const campaignFields = {
  name: required(CAMPAIGN_NAME_MAX, "A plan name", "Give the plan a name."),
  description: para(CAMPAIGN_DESCRIPTION_MAX, "The description"),
  brandId: z.string().uuid().nullable(),
  objective: z.enum(CAMPAIGN_OBJECTIVES),
  platforms: z
    .array(z.enum(SOCIAL_PROVIDER_IDS))
    .max(6)
    .transform((a) => [...new Set(a)]),
  status: z.enum(CAMPAIGN_STATUSES),
  startDate: day,
  endDate: day,
  budgetCents: z.number().int("Enter the budget as an amount like 1500.50.").min(0, "The budget can't be negative.").max(BUDGET_MAX_CENTS, "That budget is too large.").nullable(),
  budgetCurrency: z.enum(BUDGET_CURRENCIES),
  notes: para(CAMPAIGN_NOTES_MAX, "Notes"),
};
const createInput = z
  .strictObject({ ...campaignFields, templateId: z.string().uuid().nullable(), starter: z.enum(STARTER_IDS).nullable() })
  .partial()
  .required({ name: true })
  .refine((v) => !(v.templateId && v.starter), "Choose a starter plan or a saved template, not both.");
const updateInput = z
  .strictObject({ ...campaignFields })
  .partial()
  .extend({ expectedVersion: z.number().int().min(1).optional() });

type Shape = { status: CampaignStatus; startDate: string | null; endDate: string | null };
/** Dates must be in order, and a campaign that is planned or in progress needs a start date. */
function checkDates(c: Shape) {
  if (c.startDate && c.endDate && c.endDate < c.startDate) throw new AppError("VALIDATION_FAILED", "The end date must be on or after the start date.", { details: { field: "endDate" } });
  if ((c.status === "planned" || c.status === "active") && !c.startDate) throw new AppError("VALIDATION_FAILED", "Add a start date before marking the plan planned or in progress.", { details: { field: "startDate" } });
}

const milestoneInput = z.strictObject({ title: required(MILESTONE_TITLE_MAX, "A stage name", "Give the stage a name."), dueDate: day.optional() });
const milestoneUpdate = milestoneInput.partial().extend({ expectedVersion: z.number().int().min(1) });

const taskFields = {
  title: required(TASK_TITLE_MAX, "A to-do", "Describe the to-do."),
  notes: para(TASK_NOTES_MAX, "To-do notes"),
  dueDate: day,
  priority: z.enum(TASK_PRIORITIES),
  milestoneId: z.string().uuid().nullable(),
};
const taskInput = z.strictObject(taskFields).partial().required({ title: true });
/** Content fields need the version the editor loaded; ticking a task done or not does not (it can't lose work). */
const taskUpdate = z
  .strictObject({ ...taskFields, completed: z.boolean() })
  .partial()
  .extend({ expectedVersion: z.number().int().min(1).optional() })
  .refine((v) => Object.keys(v).some((k) => k !== "expectedVersion"), "Nothing to change.")
  .refine((v) => v.expectedVersion !== undefined || Object.keys(v).every((k) => k === "completed"), "Reload the plan and try again.");

const reorderInput = z.strictObject({ ids: z.array(z.string().uuid()).min(1).max(TASKS_MAX) });
const linkInput = z.strictObject({ postIds: z.array(z.string().uuid()).min(1).max(LINK_MAX) });
const unlinkInput = z.strictObject({ postId: z.string().uuid() });
const templateInput = z.strictObject({ name: required(CAMPAIGN_NAME_MAX, "A template name", "Give the template a name."), description: para(CAMPAIGN_DESCRIPTION_MAX, "The description").optional() });
const templateUpdate = templateInput.partial().refine((v) => Object.keys(v).length > 0, "Nothing to change.");

/* -------------------------------------------------------------------------- */
/*  Reads                                                                     */
/* -------------------------------------------------------------------------- */

type Row = typeof campaigns.$inferSelect;
type TaskRow = typeof campaignTasks.$inferSelect;
type MilestoneRow = typeof campaignMilestones.$inferSelect;

async function ownRow(db: Executor, customerId: string, id: string, lock = false): Promise<Row> {
  if (!isUuid(id)) throw errors.notFound("That plan");
  const q = db.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.customerId, customerId))).limit(1);
  const [row] = lock ? await q.for("update") : await q;
  if (!row) throw errors.notFound("That plan");
  return row;
}

const taskView = (t: TaskRow) => ({
  id: t.id,
  milestoneId: t.milestoneId,
  title: t.title,
  notes: t.notes,
  dueDate: t.dueDate,
  priority: t.priority as TaskPriority,
  completedAt: t.completedAt?.toISOString() ?? null,
  position: t.position,
  version: t.version,
});
const milestoneView = (m: MilestoneRow) => ({ id: m.id, title: m.title, dueDate: m.dueDate, position: m.position, version: m.version });

async function children(db: Executor, customerId: string, ids: string[]) {
  if (!ids.length) return { ms: [] as MilestoneRow[], ts: [] as TaskRow[], posts: [] as { id: string; campaignId: string | null }[] };
  // One after another: this may run inside a transaction, whose single connection can't take parallel queries.
  const ms = await db
    .select()
    .from(campaignMilestones)
    .where(and(eq(campaignMilestones.customerId, customerId), inArray(campaignMilestones.campaignId, ids)))
    .orderBy(asc(campaignMilestones.position), asc(campaignMilestones.createdAt));
  const ts = await db
    .select()
    .from(campaignTasks)
    .where(and(eq(campaignTasks.customerId, customerId), inArray(campaignTasks.campaignId, ids)))
    .orderBy(asc(campaignTasks.position), asc(campaignTasks.createdAt));
  const posts = await db
    .select({ id: socialPosts.id, campaignId: socialPosts.campaignId })
    .from(socialPosts)
    .where(and(eq(socialPosts.customerId, customerId), inArray(socialPosts.campaignId, ids)));
  return { ms, ts, posts };
}

function view(r: Row, c: Awaited<ReturnType<typeof children>>): CampaignView {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    brandId: r.brandId,
    objective: r.objective as CampaignObjective,
    platforms: r.platforms.filter(isSocialProvider),
    status: r.status as CampaignStatus,
    startDate: r.startDate,
    endDate: r.endDate,
    budgetCents: r.budgetCents,
    budgetCurrency: r.budgetCurrency as BudgetCurrency,
    notes: r.notes,
    milestones: c.ms.filter((m) => m.campaignId === r.id).map(milestoneView),
    tasks: c.ts.filter((t) => t.campaignId === r.id).map(taskView),
    postIds: c.posts.filter((p) => p.campaignId === r.id).map((p) => p.id),
    version: r.version,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export function summaryOf(c: CampaignView): CampaignSummary {
  return {
    id: c.id,
    name: c.name,
    brandId: c.brandId,
    objective: c.objective,
    platforms: c.platforms,
    status: c.status,
    startDate: c.startDate,
    endDate: c.endDate,
    taskCount: c.tasks.length,
    tasksDone: c.tasks.filter((t) => t.completedAt).length,
    postCount: c.postIds.length,
    milestones: c.milestones.map((m) => ({ id: m.id, title: m.title, dueDate: m.dueDate, done: milestoneProgress(m.id, c.tasks).reached })),
    openTasks: c.tasks
      .filter((t): t is typeof t & { dueDate: string } => !t.completedAt && !!t.dueDate)
      .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate, priority: t.priority }))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    updatedAt: c.updatedAt,
  };
}

/** The customer's campaigns, most recently changed first. */
export async function listCampaigns(db: Db, customerId: string): Promise<CampaignView[]> {
  const rows = await db.select().from(campaigns).where(eq(campaigns.customerId, customerId)).orderBy(desc(campaigns.updatedAt));
  const c = await children(db, customerId, rows.map((r) => r.id));
  return rows.map((r) => view(r, c));
}

export async function campaignSummaries(db: Db, customerId: string): Promise<CampaignSummary[]> {
  return (await listCampaigns(db, customerId)).map(summaryOf);
}

export async function getCampaign(db: Executor, customerId: string, id: string): Promise<CampaignView> {
  const row = await ownRow(db, customerId, id);
  return view(row, await children(db, customerId, [row.id]));
}

/* -------------------------------------------------------------------------- */
/*  Campaigns                                                                 */
/* -------------------------------------------------------------------------- */

/** Serialises changes to one customer's campaign and template lists so the limits hold under concurrent requests. */
async function lockCustomer(tx: Executor, customerId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`campaigns:${customerId}`}, 0))`);
}

async function assertOwnBrand(tx: Executor, customerId: string, brandId: string | null | undefined) {
  if (!brandId) return;
  const [b] = await tx.select({ id: brands.id }).from(brands).where(and(eq(brands.id, brandId), eq(brands.customerId, customerId)));
  if (!b) throw new AppError("VALIDATION_FAILED", "That brand isn't available.", { details: { field: "brandId" } });
}

async function assertRoom(tx: Executor, customerId: string) {
  const [{ n }] = (await tx.select({ n: count() }).from(campaigns).where(eq(campaigns.customerId, customerId))) as [{ n: number }];
  if (n >= CAMPAIGNS_MAX) throw errors.conflict(`You can keep up to ${CAMPAIGNS_MAX} plans. Delete ones you no longer need.`);
}

/** Inserts a structure's milestones and tasks into a campaign, placing due dates relative to its start date. */
async function insertStructure(tx: Executor, customerId: string, campaignId: string, s: TemplateStructure, start: string | null) {
  const ms = s.milestones.slice(0, MILESTONES_MAX);
  const created = ms.length
    ? await tx
        .insert(campaignMilestones)
        .values(ms.map((m, position) => ({ campaignId, customerId, title: oneLine(m.title).slice(0, MILESTONE_TITLE_MAX) || "Milestone", dueDate: dueFrom(start, m.offsetDays), position })))
        .returning({ id: campaignMilestones.id, position: campaignMilestones.position })
    : [];
  const byIndex = new Map(created.map((m) => [m.position, m.id]));
  const ts = s.tasks.slice(0, TASKS_MAX);
  if (ts.length)
    await tx.insert(campaignTasks).values(
      ts.map((t, position) => ({
        campaignId,
        customerId,
        title: oneLine(t.title).slice(0, TASK_TITLE_MAX) || "Task",
        notes: multiLine(t.notes ?? "").slice(0, TASK_NOTES_MAX),
        priority: (TASK_PRIORITIES as readonly string[]).includes(t.priority) ? t.priority : "medium",
        milestoneId: t.milestone !== null ? (byIndex.get(t.milestone) ?? null) : null,
        dueDate: dueFrom(start, t.offsetDays),
        position,
      })),
    );
}

/** Creates a campaign, optionally from one of the customer's templates (its milestones and tasks are copied). */
export async function createCampaign(db: Db, customerId: string, raw: unknown): Promise<CampaignView> {
  const { templateId, starter, ...input } = createInput.parse(raw);
  const preset = starter ? STARTER_PLANS[starter] : null;
  const status = input.status ?? "draft";
  checkDates({ status, startDate: input.startDate ?? null, endDate: input.endDate ?? null });
  await limitWrites(db, customerId);
  return guarded(() =>
    db.transaction(async (tx) => {
      await lockCustomer(tx, customerId);
      await assertRoom(tx, customerId);
      await assertOwnBrand(tx, customerId, input.brandId);
      let template: typeof campaignTemplates.$inferSelect | undefined;
      if (templateId) {
        [template] = await tx
          .select()
          .from(campaignTemplates)
          .where(and(eq(campaignTemplates.id, templateId), eq(campaignTemplates.customerId, customerId)));
        if (!template) throw new AppError("VALIDATION_FAILED", "That template isn't available.", { details: { field: "templateId" } });
      }
      const [row] = await tx
        .insert(campaigns)
        .values({
          ...input,
          customerId,
          status,
          objective: input.objective ?? (template?.objective as CampaignObjective | undefined) ?? preset?.objective ?? "awareness",
          platforms: input.platforms ?? template?.platforms.filter(isSocialProvider) ?? [],
          description: input.description ?? template?.description ?? "",
        })
        .returning();
      const structure = template?.structure ?? preset?.structure;
      if (structure) await insertStructure(tx, customerId, row!.id, structure, row!.startDate);
      return getCampaign(tx, customerId, row!.id);
    }),
  );
}

/**
 * Edits a campaign. Content edits need `expectedVersion` (the version the editor loaded); a status-only change
 * (archive, restore, mark completed) does not, since it can't overwrite someone's text.
 */
export async function updateCampaign(db: Db, customerId: string, id: string, raw: unknown): Promise<CampaignView> {
  const { expectedVersion, ...changes } = updateInput.parse(raw);
  const keys = Object.keys(changes);
  if (!keys.length) throw new AppError("VALIDATION_FAILED", "Nothing to change.");
  if (expectedVersion === undefined && !(keys.length === 1 && keys[0] === "status")) throw new AppError("VALIDATION_FAILED", "Reload the plan and try again.");
  await limitWrites(db, customerId);
  return guarded(() =>
    db.transaction(async (tx) => {
      const current = await ownRow(tx, customerId, id, true);
      if (expectedVersion !== undefined && current.version !== expectedVersion) throw errors.conflict("This plan was changed somewhere else (another tab or device). Reload to see the latest version before editing.");
      checkDates({ status: changes.status ?? (current.status as CampaignStatus), startDate: changes.startDate !== undefined ? changes.startDate : current.startDate, endDate: changes.endDate !== undefined ? changes.endDate : current.endDate });
      if (changes.brandId !== undefined && changes.brandId !== current.brandId) {
        await assertOwnBrand(tx, customerId, changes.brandId);
        if (changes.brandId) {
          const [{ n }] = (await tx
            .select({ n: count() })
            .from(socialPosts)
            .where(and(eq(socialPosts.customerId, customerId), eq(socialPosts.campaignId, id), isNotNull(socialPosts.brandId), sql`${socialPosts.brandId} <> ${changes.brandId}`))) as [{ n: number }];
          if (n > 0) throw errors.conflict(`${n} ${n === 1 ? "post is" : "posts are"} for another brand. Unlink ${n === 1 ? "it" : "them"} before changing the plan's brand.`);
        }
      }
      await tx
        .update(campaigns)
        .set({ ...changes, updatedAt: new Date(), version: sql`${campaigns.version} + 1` })
        .where(and(eq(campaigns.id, id), eq(campaigns.customerId, customerId)));
      return getCampaign(tx, customerId, id);
    }),
  );
}

/** A copy named "(copy)" as a draft, with the same milestones and tasks (not completed) and no linked content. */
export async function duplicateCampaign(db: Db, customerId: string, id: string): Promise<CampaignView> {
  await limitWrites(db, customerId);
  return guarded(() =>
    db.transaction(async (tx) => {
      await lockCustomer(tx, customerId);
      const src = await getCampaign(tx, customerId, id);
      await assertRoom(tx, customerId);
      const suffix = " (copy)";
      const [row] = await tx
        .insert(campaigns)
        .values({
          customerId,
          name: `${Array.from(src.name).slice(0, CAMPAIGN_NAME_MAX - suffix.length).join("")}${suffix}`,
          description: src.description,
          brandId: src.brandId,
          objective: src.objective,
          platforms: src.platforms,
          status: "draft",
          startDate: src.startDate,
          endDate: src.endDate,
          budgetCents: src.budgetCents,
          budgetCurrency: src.budgetCurrency,
          notes: src.notes,
        })
        .returning();
      await insertStructure(tx, customerId, row!.id, structureOf(src), src.startDate);
      return getCampaign(tx, customerId, row!.id);
    }),
  );
}

/** Deletes a campaign with its milestones and tasks. Linked drafts keep all their content and simply leave the campaign. */
export async function deleteCampaign(db: Db, customerId: string, id: string): Promise<{ unlinked: number }> {
  await limitWrites(db, customerId);
  return db.transaction(async (tx) => {
    await ownRow(tx, customerId, id, true);
    const unlinked = await tx
      .update(socialPosts)
      .set({ campaignId: null })
      .where(and(eq(socialPosts.customerId, customerId), eq(socialPosts.campaignId, id)))
      .returning({ id: socialPosts.id });
    await tx.delete(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.customerId, customerId)));
    return { unlinked: unlinked.length };
  });
}

/** Marks a campaign changed (lists sort by it) without touching its version. */
const touch = (tx: Executor, customerId: string, id: string) => tx.update(campaigns).set({ updatedAt: new Date() }).where(and(eq(campaigns.id, id), eq(campaigns.customerId, customerId)));

/* -------------------------------------------------------------------------- */
/*  Milestones                                                                */
/* -------------------------------------------------------------------------- */

async function ownMilestone(tx: Executor, customerId: string, campaignId: string, id: string) {
  if (!isUuid(id)) throw errors.notFound("That stage");
  const [m] = await tx
    .select()
    .from(campaignMilestones)
    .where(and(eq(campaignMilestones.id, id), eq(campaignMilestones.campaignId, campaignId), eq(campaignMilestones.customerId, customerId)))
    .for("update");
  if (!m) throw errors.notFound("That stage");
  return m;
}

export async function addMilestone(db: Db, customerId: string, campaignId: string, raw: unknown) {
  const input = milestoneInput.parse(raw);
  await limitWrites(db, customerId);
  return guarded(() =>
    db.transaction(async (tx) => {
      await ownRow(tx, customerId, campaignId, true);
      const [{ n, top }] = (await tx
        .select({ n: count(), top: sql<number>`coalesce(max(${campaignMilestones.position}), -1)::int` })
        .from(campaignMilestones)
        .where(and(eq(campaignMilestones.campaignId, campaignId), eq(campaignMilestones.customerId, customerId)))) as [{ n: number; top: number }];
      if (n >= MILESTONES_MAX) throw errors.conflict(`A plan can have up to ${MILESTONES_MAX} stages.`);
      const [m] = await tx
        .insert(campaignMilestones)
        .values({ campaignId, customerId, title: input.title, dueDate: input.dueDate ?? null, position: top + 1 })
        .returning();
      await touch(tx, customerId, campaignId);
      return milestoneView(m!);
    }),
  );
}

export async function updateMilestone(db: Db, customerId: string, campaignId: string, id: string, raw: unknown) {
  const { expectedVersion, ...changes } = milestoneUpdate.parse(raw);
  if (!Object.keys(changes).length) throw new AppError("VALIDATION_FAILED", "Nothing to change.");
  await limitWrites(db, customerId);
  return guarded(() =>
    db.transaction(async (tx) => {
      await ownRow(tx, customerId, campaignId, true);
      const m = await ownMilestone(tx, customerId, campaignId, id);
      if (m.version !== expectedVersion) throw errors.conflict("This stage was changed somewhere else. Reload to see the latest version.");
      const [u] = await tx
        .update(campaignMilestones)
        .set({ ...changes, updatedAt: new Date(), version: sql`${campaignMilestones.version} + 1` })
        .where(eq(campaignMilestones.id, id))
        .returning();
      await touch(tx, customerId, campaignId);
      return milestoneView(u!);
    }),
  );
}

/** Deletes a milestone. Its tasks are kept and become ungrouped. */
export async function deleteMilestone(db: Db, customerId: string, campaignId: string, id: string) {
  await limitWrites(db, customerId);
  await db.transaction(async (tx) => {
    await ownRow(tx, customerId, campaignId, true);
    await ownMilestone(tx, customerId, campaignId, id);
    await tx.delete(campaignMilestones).where(eq(campaignMilestones.id, id));
    await touch(tx, customerId, campaignId);
  });
}

/* -------------------------------------------------------------------------- */
/*  Tasks                                                                     */
/* -------------------------------------------------------------------------- */

async function ownTask(tx: Executor, customerId: string, campaignId: string, id: string) {
  if (!isUuid(id)) throw errors.notFound("That to-do");
  const [t] = await tx
    .select()
    .from(campaignTasks)
    .where(and(eq(campaignTasks.id, id), eq(campaignTasks.campaignId, campaignId), eq(campaignTasks.customerId, customerId)))
    .for("update");
  if (!t) throw errors.notFound("That to-do");
  return t;
}

async function assertMilestoneOf(tx: Executor, customerId: string, campaignId: string, milestoneId: string | null | undefined) {
  if (!milestoneId) return;
  const [m] = await tx
    .select({ id: campaignMilestones.id })
    .from(campaignMilestones)
    .where(and(eq(campaignMilestones.id, milestoneId), eq(campaignMilestones.campaignId, campaignId), eq(campaignMilestones.customerId, customerId)));
  if (!m) throw new AppError("VALIDATION_FAILED", "That stage isn't part of this plan.", { details: { field: "milestoneId" } });
}

export async function addTask(db: Db, customerId: string, campaignId: string, raw: unknown) {
  const input = taskInput.parse(raw);
  await limitWrites(db, customerId);
  return guarded(() =>
    db.transaction(async (tx) => {
      await ownRow(tx, customerId, campaignId, true);
      await assertMilestoneOf(tx, customerId, campaignId, input.milestoneId);
      const [{ n, top }] = (await tx
        .select({ n: count(), top: sql<number>`coalesce(max(${campaignTasks.position}), -1)::int` })
        .from(campaignTasks)
        .where(and(eq(campaignTasks.campaignId, campaignId), eq(campaignTasks.customerId, customerId)))) as [{ n: number; top: number }];
      if (n >= TASKS_MAX) throw errors.conflict(`A plan can have up to ${TASKS_MAX} to-dos.`);
      const [t] = await tx
        .insert(campaignTasks)
        .values({ campaignId, customerId, title: input.title, notes: input.notes ?? "", dueDate: input.dueDate ?? null, priority: input.priority ?? "medium", milestoneId: input.milestoneId ?? null, position: top + 1 })
        .returning();
      await touch(tx, customerId, campaignId);
      return taskView(t!);
    }),
  );
}

export async function updateTask(db: Db, customerId: string, campaignId: string, id: string, raw: unknown) {
  const { expectedVersion, completed, ...changes } = taskUpdate.parse(raw);
  await limitWrites(db, customerId);
  return guarded(() =>
    db.transaction(async (tx) => {
      await ownRow(tx, customerId, campaignId, true);
      const t = await ownTask(tx, customerId, campaignId, id);
      if (expectedVersion !== undefined && t.version !== expectedVersion) throw errors.conflict("This to-do was changed somewhere else. Reload to see the latest version.");
      if (changes.milestoneId !== undefined) await assertMilestoneOf(tx, customerId, campaignId, changes.milestoneId);
      const edits = Object.keys(changes).length > 0;
      const [u] = await tx
        .update(campaignTasks)
        .set({
          ...changes,
          ...(completed !== undefined && { completedAt: completed ? (t.completedAt ?? new Date()) : null }),
          updatedAt: new Date(),
          ...(edits && { version: sql`${campaignTasks.version} + 1` }),
        })
        .where(eq(campaignTasks.id, id))
        .returning();
      await touch(tx, customerId, campaignId);
      return taskView(u!);
    }),
  );
}

export async function deleteTask(db: Db, customerId: string, campaignId: string, id: string) {
  await limitWrites(db, customerId);
  await db.transaction(async (tx) => {
    await ownRow(tx, customerId, campaignId, true);
    await ownTask(tx, customerId, campaignId, id);
    await tx.delete(campaignTasks).where(eq(campaignTasks.id, id));
    await touch(tx, customerId, campaignId);
  });
}

/** Sets the order of the campaign's tasks. The list must be exactly the campaign's current tasks. */
export async function reorderTasks(db: Db, customerId: string, campaignId: string, raw: unknown) {
  const { ids } = reorderInput.parse(raw);
  await limitWrites(db, customerId);
  await db.transaction(async (tx) => {
    await ownRow(tx, customerId, campaignId, true);
    const current = await tx
      .select({ id: campaignTasks.id })
      .from(campaignTasks)
      .where(and(eq(campaignTasks.campaignId, campaignId), eq(campaignTasks.customerId, customerId)));
    const have = new Set(current.map((t) => t.id));
    if (new Set(ids).size !== ids.length || ids.length !== have.size || ids.some((x) => !have.has(x))) throw errors.conflict("The to-do list changed somewhere else. Reload and try again.");
    for (const [position, id] of ids.entries()) await tx.update(campaignTasks).set({ position }).where(and(eq(campaignTasks.id, id), eq(campaignTasks.customerId, customerId)));
    await touch(tx, customerId, campaignId);
  });
}

/* -------------------------------------------------------------------------- */
/*  Content links                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Links the customer's own drafts to a campaign. Content is not copied and its version is not bumped (linking is
 * organisation, not an edit). A draft already in another campaign, or for a different brand, is skipped with a
 * reason; an unbranded draft takes the campaign's brand so the campaign stays on one brand.
 */
export async function linkPosts(db: Db, customerId: string, campaignId: string, raw: unknown): Promise<{ linked: number; skipped: { id: string; reason: string }[] }> {
  const { postIds } = linkInput.parse(raw);
  await limitWrites(db, customerId);
  return db.transaction(async (tx) => {
    const c = await ownRow(tx, customerId, campaignId, true);
    const ids = [...new Set(postIds)];
    const rows = await tx
      .select({ id: socialPosts.id, campaignId: socialPosts.campaignId, brandId: socialPosts.brandId })
      .from(socialPosts)
      .where(and(eq(socialPosts.customerId, customerId), inArray(socialPosts.id, ids)))
      .for("update");
    const found = new Map(rows.map((r) => [r.id, r]));
    let linked = 0;
    const skipped: { id: string; reason: string }[] = [];
    for (const id of ids) {
      const p = found.get(id);
      if (!p) skipped.push({ id, reason: "That post wasn't found." });
      else if (p.campaignId === campaignId) continue;
      else if (p.campaignId) skipped.push({ id, reason: "It's already part of another plan." });
      else if (c.brandId && p.brandId && p.brandId !== c.brandId) skipped.push({ id, reason: "It's for a different brand than this plan." });
      else {
        await tx
          .update(socialPosts)
          .set({ campaignId, ...(c.brandId && !p.brandId && { brandId: c.brandId }), updatedAt: new Date() })
          .where(and(eq(socialPosts.id, id), eq(socialPosts.customerId, customerId)));
        linked++;
      }
    }
    if (linked) await touch(tx, customerId, campaignId);
    return { linked, skipped };
  });
}

/** Removes a draft from the campaign. The draft itself is kept exactly as it is. */
export async function unlinkPost(db: Db, customerId: string, campaignId: string, raw: unknown) {
  const { postId } = unlinkInput.parse(raw);
  await limitWrites(db, customerId);
  await db.transaction(async (tx) => {
    await ownRow(tx, customerId, campaignId, true);
    const r = await tx
      .update(socialPosts)
      .set({ campaignId: null, updatedAt: new Date() })
      .where(and(eq(socialPosts.id, postId), eq(socialPosts.customerId, customerId), eq(socialPosts.campaignId, campaignId)))
      .returning({ id: socialPosts.id });
    if (!r.length) throw errors.notFound("That post in this plan");
    await touch(tx, customerId, campaignId);
  });
}

/* -------------------------------------------------------------------------- */
/*  Templates                                                                 */
/* -------------------------------------------------------------------------- */

type TemplateRow = typeof campaignTemplates.$inferSelect;
const templateView = (t: TemplateRow): CampaignTemplateView => ({
  id: t.id,
  name: t.name,
  description: t.description,
  objective: t.objective as CampaignObjective,
  platforms: t.platforms.filter(isSocialProvider),
  structure: t.structure,
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
});

export async function listTemplates(db: Db, customerId: string): Promise<CampaignTemplateView[]> {
  const rows = await db.select().from(campaignTemplates).where(eq(campaignTemplates.customerId, customerId)).orderBy(sql`lower(${campaignTemplates.name})`);
  return rows.map(templateView);
}

/** Saves a campaign's objective, platforms, milestones and tasks as an independent template (no content, dates become offsets). */
export async function saveAsTemplate(db: Db, customerId: string, campaignId: string, raw: unknown): Promise<CampaignTemplateView> {
  const input = templateInput.parse(raw);
  await limitWrites(db, customerId);
  return guarded(() =>
    db.transaction(async (tx) => {
      await lockCustomer(tx, customerId);
      const c = await getCampaign(tx, customerId, campaignId);
      const [{ n }] = (await tx.select({ n: count() }).from(campaignTemplates).where(eq(campaignTemplates.customerId, customerId))) as [{ n: number }];
      if (n >= CAMPAIGN_TEMPLATES_MAX) throw errors.conflict(`You can keep up to ${CAMPAIGN_TEMPLATES_MAX} templates. Delete ones you no longer use.`);
      const [t] = await tx
        .insert(campaignTemplates)
        .values({ customerId, name: input.name, description: input.description ?? c.description, objective: c.objective, platforms: c.platforms, structure: structureOf(c) })
        .returning();
      return templateView(t!);
    }),
  );
}

export async function updateTemplate(db: Db, customerId: string, id: string, raw: unknown): Promise<CampaignTemplateView> {
  const changes = templateUpdate.parse(raw);
  if (!isUuid(id)) throw errors.notFound("That template");
  await limitWrites(db, customerId);
  return guarded(async () => {
    const [t] = await db
      .update(campaignTemplates)
      .set({ ...changes, updatedAt: new Date() })
      .where(and(eq(campaignTemplates.id, id), eq(campaignTemplates.customerId, customerId)))
      .returning();
    if (!t) throw errors.notFound("That template");
    return templateView(t);
  });
}

/** Deletes a template. Campaigns created from it are independent and unaffected. */
export async function deleteTemplate(db: Db, customerId: string, id: string) {
  if (!isUuid(id)) throw errors.notFound("That template");
  await limitWrites(db, customerId);
  const r = await db
    .delete(campaignTemplates)
    .where(and(eq(campaignTemplates.id, id), eq(campaignTemplates.customerId, customerId)))
    .returning({ id: campaignTemplates.id });
  if (!r.length) throw errors.notFound("That template");
}

/* -------------------------------------------------------------------------- */
/*  Export                                                                    */
/* -------------------------------------------------------------------------- */

/** Escapes one CSV cell; text a spreadsheet could run as a formula is prefixed with an apostrophe. */
function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The campaign's milestones, tasks and linked content as CSV (owner only, nothing invented). */
export async function exportCampaign(db: Db, customerId: string, id: string): Promise<{ csv: string; filename: string }> {
  const c = await getCampaign(db, customerId, id);
  const posts = c.postIds.length
    ? await db
        .select({ title: socialPosts.title, body: socialPosts.body, status: socialPosts.status, plannedAt: socialPosts.plannedAt, providers: socialPosts.providers })
        .from(socialPosts)
        .where(and(eq(socialPosts.customerId, customerId), eq(socialPosts.campaignId, id)))
        .orderBy(asc(socialPosts.plannedAt))
    : [];
  const ms = new Map(c.milestones.map((m) => [m.id, m.title]));
  const rows: unknown[][] = [["Type", "Title", "Stage", "Due or planned", "Priority", "Status", "Platforms"]];
  for (const m of c.milestones) {
    const p = milestoneProgress(m.id, c.tasks);
    rows.push(["Stage", m.title, "", m.dueDate, "", p.total ? `${p.done}/${p.total} to-dos done` : "No to-dos", ""]);
  }
  for (const t of c.tasks) rows.push(["To-do", t.title, t.milestoneId ? (ms.get(t.milestoneId) ?? "") : "", t.dueDate, t.priority, t.completedAt ? "Done" : "Open", ""]);
  for (const p of posts) rows.push(["Post", p.title?.trim() || p.body.trim().split("\n")[0]?.slice(0, 80) || "Untitled", "", p.plannedAt?.toISOString().slice(0, 16).replace("T", " ") ?? "", "", p.status, p.providers.join(" ")]);
  const csv = rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
  const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "plan";
  return { csv, filename: `marketing-plan-${slug}.csv` };
}
