import type { SocialProviderId } from "./social/platforms";

/*
 * Campaign Planner (CP-01): limits, types and small pure helpers shared by the server, the planner and the
 * calendar. A campaign is a customer's own plan: its status is what the customer sets, nothing runs, publishes
 * or spends money, and every number shown is either counted from their own tasks and content or typed by them.
 */

export const CAMPAIGNS_MAX = 100;
export const CAMPAIGN_TEMPLATES_MAX = 30;
export const MILESTONES_MAX = 30;
export const TASKS_MAX = 200;
export const CAMPAIGN_NAME_MAX = 80;
export const CAMPAIGN_DESCRIPTION_MAX = 1000;
export const CAMPAIGN_NOTES_MAX = 4000;
export const MILESTONE_TITLE_MAX = 100;
export const TASK_TITLE_MAX = 140;
export const TASK_NOTES_MAX = 1000;
/** Planning budgets are whole units up to a billion (stored in cents). */
export const BUDGET_MAX_CENTS = 100_000_000_000;
export const LINK_MAX = 50;

export const CAMPAIGN_STATUSES = ["draft", "planned", "active", "completed", "archived"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export const STATUS_LABEL: Record<CampaignStatus, string> = { draft: "Draft", planned: "Planned", active: "In progress", completed: "Completed", archived: "Archived" };
export const STATUS_HELP: Record<CampaignStatus, string> = {
  draft: "Still an idea.",
  planned: "Dates are set and it's ready to start.",
  active: "You're working on it now.",
  completed: "All done.",
  archived: "Put away for reference.",
};

/** The feature's name and its words, in one place (CP-01 UX pass: plain language). */
export const PLAN_NAME = "Marketing Plans";

/** "1 stage · 3 to-dos" */
export const stepCount = (s: { milestones: unknown[]; tasks: unknown[] }) => `${s.milestones.length} ${s.milestones.length === 1 ? "stage" : "stages"} · ${s.tasks.length} ${s.tasks.length === 1 ? "to-do" : "to-dos"}`;

export const CAMPAIGN_OBJECTIVES = ["awareness", "engagement", "traffic", "leads", "sales", "launch", "community", "other"] as const;
export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number];
export const OBJECTIVE_LABEL: Record<CampaignObjective, string> = {
  awareness: "Get noticed",
  engagement: "Get more engagement",
  traffic: "Drive website visits",
  leads: "Get leads & sign-ups",
  sales: "Sell more",
  launch: "Launch something new",
  community: "Grow a community",
  other: "Something else",
};

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const PRIORITY_LABEL: Record<TaskPriority, string> = { low: "Low", medium: "Medium", high: "High" };

export const BUDGET_CURRENCIES = ["USD", "EUR", "GBP", "PKR", "AED", "SAR", "INR", "CAD"] as const;
export type BudgetCurrency = (typeof BUDGET_CURRENCIES)[number];

export const CAMPAIGN_ROUTES = { home: "/dashboard/campaigns", create: "/dashboard/campaigns/new" } as const;
export const campaignHref = (id: string, tab?: "tasks" | "content" | "report") => `${CAMPAIGN_ROUTES.home}/${encodeURIComponent(id)}${tab ? `?tab=${tab}` : ""}`;
export const campaignEditHref = (id: string) => `${CAMPAIGN_ROUTES.home}/${encodeURIComponent(id)}/edit`;

/* -------------------------------------------------------------------------- */
/*  Views                                                                     */
/* -------------------------------------------------------------------------- */

export interface MilestoneView {
  id: string;
  title: string;
  /** A plain calendar date (YYYY-MM-DD), no time zone. */
  dueDate: string | null;
  position: number;
  version: number;
}

export interface TaskView {
  id: string;
  milestoneId: string | null;
  title: string;
  notes: string;
  dueDate: string | null;
  priority: TaskPriority;
  completedAt: string | null;
  position: number;
  version: number;
}

export interface CampaignView {
  id: string;
  name: string;
  description: string;
  brandId: string | null;
  objective: CampaignObjective;
  platforms: SocialProviderId[];
  status: CampaignStatus;
  startDate: string | null;
  endDate: string | null;
  /** Customer-entered planning budget, in cents. Nothing is spent or charged. */
  budgetCents: number | null;
  budgetCurrency: BudgetCurrency;
  notes: string;
  milestones: MilestoneView[];
  tasks: TaskView[];
  /** Ids of the customer's own posts linked to this campaign. */
  postIds: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** What lists, cards, filters and the calendar need. */
export interface CampaignSummary {
  id: string;
  name: string;
  brandId: string | null;
  objective: CampaignObjective;
  platforms: SocialProviderId[];
  status: CampaignStatus;
  startDate: string | null;
  endDate: string | null;
  taskCount: number;
  tasksDone: number;
  postCount: number;
  milestones: { id: string; title: string; dueDate: string | null; done: boolean }[];
  /** Open tasks with a due date, soonest first (for overdue and upcoming work). */
  openTasks: { id: string; title: string; dueDate: string; priority: TaskPriority }[];
  updatedAt: string;
}

export interface TemplateStructure {
  milestones: { title: string; offsetDays: number | null }[];
  tasks: { title: string; notes: string; priority: TaskPriority; milestone: number | null; offsetDays: number | null }[];
}

export interface CampaignTemplateView {
  id: string;
  name: string;
  description: string;
  objective: CampaignObjective;
  platforms: SocialProviderId[];
  structure: TemplateStructure;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Dates                                                                     */
/* -------------------------------------------------------------------------- */

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export function isDate(s: string | null | undefined): s is string {
  if (!s || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d && y >= 2000 && y <= 2100;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Whole days from a to b (b - a). */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** Today's date where the viewer is. */
export function localToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export const formatDate = (d: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) => new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(Date.parse(`${d}T00:00:00Z`));

export function formatRange(start: string | null, end: string | null): string {
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start) return `From ${formatDate(start)}`;
  if (end) return `Until ${formatDate(end)}`;
  return "No dates yet";
}

/* -------------------------------------------------------------------------- */
/*  Progress (only ever counted from the customer's real tasks)               */
/* -------------------------------------------------------------------------- */

/** Completed share of tasks as a whole percentage; null when there are no tasks to count. */
export const percent = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : null);

/** A milestone is reached when it has at least one task and every one of them is complete. */
export function milestoneProgress(milestoneId: string, tasks: Pick<TaskView, "milestoneId" | "completedAt">[]) {
  const mine = tasks.filter((t) => t.milestoneId === milestoneId);
  const done = mine.filter((t) => t.completedAt).length;
  return { total: mine.length, done, reached: mine.length > 0 && done === mine.length };
}

export type DueState = "overdue" | "today" | "soon" | "later" | "none";
/** Where an open task's due date sits relative to today (soon = within 7 days). */
export function dueState(dueDate: string | null, today: string, done = false): DueState {
  if (!dueDate || done) return "none";
  const d = daysBetween(today, dueDate);
  return d < 0 ? "overdue" : d === 0 ? "today" : d <= 7 ? "soon" : "later";
}

/**
 * A gentle check that the status the customer chose still matches the dates (status is never changed for them).
 * Returns a short note, or null when it's consistent.
 */
export function statusNote(c: Pick<CampaignView, "status" | "startDate" | "endDate">, today: string): string | null {
  if ((c.status === "draft" || c.status === "planned") && c.endDate && c.endDate < today) return "The end date has passed. Mark it completed or move the dates.";
  if (c.status === "planned" && c.startDate && c.startDate < today) return "The start date has passed. Mark it in progress when work begins.";
  if (c.status === "active" && c.endDate && c.endDate < today) return "The end date has passed. Mark it completed when the work is done.";
  if (c.status === "active" && c.startDate && c.startDate > today) return `Starts on ${formatDate(c.startDate)}.`;
  return null;
}

/** Cents to "1,250.00" for display in the customer's chosen currency. */
export function formatBudget(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/** "1,250.5" or "1250.50" → cents; null when blank, NaN when it isn't a valid amount. */
export function parseBudget(input: string): number | null {
  const s = input.replace(/[,\s]/g, "");
  if (!s) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return Number.NaN;
  const cents = Math.round(Number(s) * 100);
  return cents <= BUDGET_MAX_CENTS ? cents : Number.NaN;
}

/* -------------------------------------------------------------------------- */
/*  Templates                                                                 */
/* -------------------------------------------------------------------------- */

/** A campaign's milestones and tasks as a reusable structure; due dates become offsets from its start date. */
export function structureOf(c: Pick<CampaignView, "startDate" | "milestones" | "tasks">): TemplateStructure {
  const offset = (d: string | null) => (d && c.startDate ? daysBetween(c.startDate, d) : null);
  const ms = [...c.milestones].sort((a, b) => a.position - b.position);
  return {
    milestones: ms.map((m) => ({ title: m.title, offsetDays: offset(m.dueDate) })),
    tasks: [...c.tasks]
      .sort((a, b) => a.position - b.position)
      .map((t) => {
        const i = t.milestoneId ? ms.findIndex((m) => m.id === t.milestoneId) : -1;
        return { title: t.title, notes: t.notes, priority: t.priority, milestone: i >= 0 ? i : null, offsetDays: offset(t.dueDate) };
      }),
  };
}

/* -------------------------------------------------------------------------- */
/*  Starter plans                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Built-in step lists people can start from instead of a blank plan. They are suggested stages and to-dos only
 * (no numbers or results); due dates are days from the plan's start date.
 */
type Step = [title: string, offsetDays: number, priority?: TaskPriority];
function starter(stages: [string, number][], todos: [stage: number, ...Step][]): TemplateStructure {
  return {
    milestones: stages.map(([title, offsetDays]) => ({ title, offsetDays })),
    tasks: todos.map(([milestone, title, offsetDays, priority]) => ({ title, notes: "", priority: priority ?? "medium", milestone, offsetDays })),
  };
}

export const STARTER_PLANS = {
  launch: {
    name: "Product launch",
    description: "Build up to a launch day, then follow up.",
    objective: "launch" as CampaignObjective,
    structure: starter(
      [
        ["Get ready", 7],
        ["Launch day", 14],
        ["Follow up", 21],
      ],
      [
        [0, "Decide the key message", 2, "high"],
        [0, "Prepare photos or videos", 5],
        [0, "Write the captions", 6],
        [1, "Publish the launch post", 14, "high"],
        [1, "Reply to comments and messages", 15],
        [2, "Share a customer reaction or FAQ", 18],
        [2, "Note what worked for next time", 21, "low"],
      ],
    ),
  },
  sale: {
    name: "Seasonal sale",
    description: "Plan an offer, run it, and wrap it up.",
    objective: "sales" as CampaignObjective,
    structure: starter(
      [
        ["Plan the offer", 3],
        ["Sale is live", 7],
        ["Wrap up", 14],
      ],
      [
        [0, "Choose the products and discount", 1, "high"],
        [0, "Create the sale graphics", 3],
        [0, "Post a countdown teaser", 5],
        [1, "Announce the sale", 7, "high"],
        [1, "Post a last-chance reminder", 12],
        [2, "Thank your customers", 14, "low"],
      ],
    ),
  },
  weekly: {
    name: "Weekly content",
    description: "A simple routine for a week of posts.",
    objective: "engagement" as CampaignObjective,
    structure: starter(
      [
        ["Plan", 0],
        ["Create", 3],
        ["Post and engage", 6],
      ],
      [
        [0, "Pick three topics", 0, "high"],
        [1, "Write the posts", 2],
        [1, "Prepare the images", 3],
        [2, "Choose posting times", 4],
        [2, "Reply to comments", 6],
      ],
    ),
  },
  event: {
    name: "Event promotion",
    description: "Announce an event, remind people, and share highlights.",
    objective: "awareness" as CampaignObjective,
    structure: starter(
      [
        ["Announce", 0],
        ["Build up", 7],
        ["Event day", 14],
        ["After the event", 16],
      ],
      [
        [0, "Announce the event", 0, "high"],
        [1, "Share the venue, guests or agenda", 4],
        [1, "Post a reminder one week before", 7],
        [1, "Post a reminder the day before", 13],
        [2, "Share live updates", 14, "high"],
        [3, "Thank attendees and share highlights", 16],
      ],
    ),
  },
} as const;
export type StarterId = keyof typeof STARTER_PLANS;
export const STARTER_IDS = Object.keys(STARTER_PLANS) as [StarterId, ...StarterId[]];

/** Due dates for a structure placed at a start date (none when there's no start date). */
export const dueFrom = (start: string | null, offsetDays: number | null) => (start && offsetDays !== null ? addDays(start, offsetDays) : null);
