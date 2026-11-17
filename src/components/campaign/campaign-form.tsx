"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, FilePlus2, Heart, Info, LayoutTemplate, Megaphone, MousePointerClick, Rocket, ShoppingBag, Sparkles, UserPlus, Users, type LucideIcon } from "lucide-react";
import { BrandSelect } from "@/components/brand/brand-parts";
import { eyebrow, page, primaryButton, quietButton, socialApi } from "@/components/social/parts";
import { useUnsavedWarning } from "@/components/social/publishing-parts";
import { BRAND_ROUTES } from "@/lib/brand";
import {
  BUDGET_CURRENCIES,
  CAMPAIGN_DESCRIPTION_MAX,
  CAMPAIGN_NAME_MAX,
  CAMPAIGN_NOTES_MAX,
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_ROUTES,
  CAMPAIGN_STATUSES,
  CAMPAIGNS_MAX,
  campaignHref,
  OBJECTIVE_LABEL,
  parseBudget,
  PLAN_NAME,
  STARTER_IDS,
  STARTER_PLANS,
  STATUS_HELP,
  STATUS_LABEL,
  stepCount,
  type BudgetCurrency,
  type CampaignObjective,
  type CampaignStatus,
  type CampaignView,
  type StarterId,
} from "@/lib/campaign";
import { SOCIAL_PLATFORM, SOCIAL_PROVIDER_IDS, type SocialProviderId } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";
import { field, label, NoticeBar, type Notice } from "./campaign-parts";
import type { FormData } from "./loader";

type Errors = Partial<Record<"name" | "dates" | "budget", string>>;
/** Where a new plan starts: blank, a built-in starter plan, or one of the customer's saved templates. */
type Start = { kind: "blank" } | { kind: "starter"; id: StarterId } | { kind: "template"; id: string };

export const GOAL_ICON: Record<CampaignObjective, LucideIcon> = {
  awareness: Megaphone,
  engagement: Heart,
  traffic: MousePointerClick,
  leads: UserPlus,
  sales: ShoppingBag,
  launch: Rocket,
  community: Users,
  other: Sparkles,
};

const card = "rounded-3xl border bg-card p-4 shadow-soft sm:p-5";
const choice = "relative flex cursor-pointer rounded-2xl border bg-background p-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/[0.06] has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-primary/30 hover:border-primary/40 dark:bg-white/[0.02]";

/** Creates or edits a marketing plan. Only a name is required; everything else can be added later. */
export function CampaignForm({ campaign, count, templates, brands, templateId }: FormData & { templateId?: string }) {
  const router = useRouter();
  const editing = !!campaign;
  const initialStart: Start = !editing && templateId && templates.some((t) => t.id === templateId) ? { kind: "template", id: templateId } : { kind: "blank" };
  const [start, setStart] = React.useState<Start>(initialStart);
  const preset = start.kind === "starter" ? STARTER_PLANS[start.id] : start.kind === "template" ? templates.find((t) => t.id === start.id) : undefined;
  const [name, setName] = React.useState(campaign?.name ?? "");
  const [description, setDescription] = React.useState(campaign?.description ?? (preset && "description" in preset ? preset.description : ""));
  const [brandId, setBrandId] = React.useState<string | null>(campaign ? campaign.brandId : (brands.find((b) => b.isDefault)?.id ?? null));
  const [objective, setObjective] = React.useState<CampaignObjective>(campaign?.objective ?? preset?.objective ?? "awareness");
  const [platforms, setPlatforms] = React.useState<SocialProviderId[]>(campaign?.platforms ?? (preset && "platforms" in preset ? [...preset.platforms] : []));
  const [status, setStatus] = React.useState<CampaignStatus>(campaign?.status ?? "draft");
  const [statusTouched, setStatusTouched] = React.useState(editing);
  const [startDate, setStartDate] = React.useState(campaign?.startDate ?? "");
  const [endDate, setEndDate] = React.useState(campaign?.endDate ?? "");
  const [budget, setBudget] = React.useState(campaign?.budgetCents != null ? (campaign.budgetCents / 100).toFixed(campaign.budgetCents % 100 ? 2 : 0) : "");
  const [currency, setCurrency] = React.useState<BudgetCurrency>(campaign?.budgetCurrency ?? "USD");
  const [notes, setNotes] = React.useState(campaign?.notes ?? "");
  const [errors, setErrors] = React.useState<Errors>({});
  const [notice, setNotice] = React.useState<Notice>(null);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [more, setMore] = React.useState(editing);
  const inFlight = React.useRef(false);
  useUnsavedWarning(dirty && !saving);

  const full = !editing && count >= CAMPAIGNS_MAX;
  const change =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setDirty(true);
    };

  function pickStart(s: Start) {
    setStart(s);
    setDirty(true);
    const p = s.kind === "starter" ? STARTER_PLANS[s.id] : s.kind === "template" ? templates.find((t) => t.id === s.id) : undefined;
    if (!p) return;
    setObjective(p.objective);
    if ("platforms" in p && p.platforms.length) setPlatforms([...p.platforms]);
    if (!description.trim() && p.description) setDescription(p.description);
    if (!name.trim()) setName(p.name);
  }

  /** Picking a start date makes a new plan "Planned" unless the customer chose a status themselves. */
  function pickStartDate(v: string) {
    change(setStartDate)(v);
    if (!statusTouched) setStatus(v ? "planned" : "draft");
  }

  function validate(): Errors {
    const e: Errors = {};
    if (!name.trim()) e.name = "Give your plan a name.";
    if (startDate && endDate && endDate < startDate) e.dates = "The end date must be on or after the start date.";
    else if ((status === "planned" || status === "active") && !startDate) e.dates = "Add a start date, or set the status to Draft under More details.";
    if (Number.isNaN(parseBudget(budget))) e.budget = "Enter an amount like 1500 or 1500.50.";
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (inFlight.current) return;
    const e = validate();
    setErrors(e);
    if (e.budget) setMore(true);
    if (Object.keys(e).length) {
      setNotice({ ok: false, text: "Check the highlighted fields." });
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setNotice(null);
    const payload = {
      name,
      description,
      brandId,
      objective,
      platforms,
      status,
      startDate: startDate || null,
      endDate: endDate || null,
      budgetCents: parseBudget(budget),
      budgetCurrency: currency,
      notes,
      ...(editing ? { expectedVersion: campaign.version } : start.kind === "template" ? { templateId: start.id } : start.kind === "starter" ? { starter: start.id } : {}),
    };
    const r = await socialApi<{ campaign: CampaignView }>(editing ? `/api/campaigns/${campaign.id}` : "/api/campaigns", { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload) });
    inFlight.current = false;
    if (!r.ok) {
      setSaving(false);
      setNotice({ ok: false, text: r.message });
      return;
    }
    setDirty(false);
    router.push(campaignHref(r.data.campaign.id));
    router.refresh();
  }

  const steps = preset ? ("structure" in preset ? preset.structure : null) : null;

  return (
    <div className={page}>
      <Link href={editing ? campaignHref(campaign.id) : CAMPAIGN_ROUTES.home} className="inline-flex items-center gap-1.5 rounded text-[0.84rem] font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40">
        <ArrowLeft className="size-4" aria-hidden /> {editing ? campaign.name : PLAN_NAME}
      </Link>
      <header className="mt-3">
        <p className={cn(eyebrow, "text-primary")}>{PLAN_NAME}</p>
        <h1 className="mt-1.5 font-heading text-[1.5rem] leading-tight font-extrabold tracking-tight sm:text-[1.8rem]">{editing ? "Edit plan" : "New marketing plan"}</h1>
        {!editing ? <p className="mt-1 text-sm text-muted-foreground">Only a name is needed. You can add to-dos and posts on the next screen.</p> : null}
      </header>

      {full ? (
        <p role="alert" className="mt-4 rounded-2xl bg-destructive/[0.08] px-4 py-3 text-sm font-medium text-[#a12828] dark:text-destructive">
          You&apos;ve reached the limit of {CAMPAIGNS_MAX} plans. Delete one you no longer need first.
        </p>
      ) : (
        <form onSubmit={submit} noValidate className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="grid min-w-0 gap-5">
            {!editing ? (
              <fieldset className={card}>
                <legend className="sr-only">Start from</legend>
                <h2 className="font-heading text-[1rem] font-bold" aria-hidden>
                  1. Start from
                </h2>
                <p className="mt-0.5 text-[0.8rem] text-muted-foreground">A starter plan fills in suggested stages and to-dos. You can change or remove any of them.</p>
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  <label className={choice}>
                    <input type="radio" name="start" className="sr-only" checked={start.kind === "blank"} onChange={() => pickStart({ kind: "blank" })} />
                    <span className="flex gap-2.5">
                      <FilePlus2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                      <span>
                        <span className="block text-[0.9rem] font-semibold">Blank plan</span>
                        <span className="block text-[0.76rem] text-muted-foreground">Start from scratch.</span>
                      </span>
                    </span>
                  </label>
                  {STARTER_IDS.map((id) => {
                    const s = STARTER_PLANS[id];
                    const Icon = GOAL_ICON[s.objective];
                    return (
                      <label key={id} className={choice}>
                        <input type="radio" name="start" className="sr-only" checked={start.kind === "starter" && start.id === id} onChange={() => pickStart({ kind: "starter", id })} />
                        <span className="flex gap-2.5">
                          <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                          <span>
                            <span className="block text-[0.9rem] font-semibold">{s.name}</span>
                            <span className="block text-[0.76rem] text-muted-foreground">{s.description}</span>
                            <span className="mt-1 block text-[0.72rem] font-medium text-muted-foreground">
                              {stepCount(s.structure)}
                            </span>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                  {templates.map((t) => (
                    <label key={t.id} className={choice}>
                      <input type="radio" name="start" className="sr-only" checked={start.kind === "template" && start.id === t.id} onChange={() => pickStart({ kind: "template", id: t.id })} />
                      <span className="flex gap-2.5">
                        <LayoutTemplate className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                        <span className="min-w-0">
                          <span className="block truncate text-[0.9rem] font-semibold">{t.name}</span>
                          <span className="block text-[0.76rem] text-muted-foreground">Your template</span>
                          <span className="mt-1 block text-[0.72rem] font-medium text-muted-foreground">
                            {stepCount(t.structure)}
                          </span>
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

            <section className={cn(card, "grid gap-4")} aria-labelledby="f-basics">
              <h2 id="f-basics" className="font-heading text-[1rem] font-bold">
                {editing ? "The basics" : "2. The basics"}
              </h2>
              <div>
                <label htmlFor="f-name" className={label}>
                  Plan name <span className="text-destructive">*</span>
                </label>
                <input id="f-name" value={name} onChange={(e) => change(setName)(e.target.value)} maxLength={CAMPAIGN_NAME_MAX} required aria-invalid={errors.name ? true : undefined} aria-describedby={errors.name ? "f-name-err" : undefined} className={cn(field, "mt-1.5")} placeholder="e.g. Summer sale" />
                {errors.name ? (
                  <p id="f-name-err" className="mt-1 text-[0.76rem] font-medium text-destructive">
                    {errors.name}
                  </p>
                ) : null}
              </div>
              <fieldset>
                <legend className={label}>What&apos;s the goal?</legend>
                <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CAMPAIGN_OBJECTIVES.map((o) => {
                    const Icon = GOAL_ICON[o];
                    return (
                      <label key={o} className={cn(choice, "items-center gap-2 px-3 py-2.5")}>
                        <input type="radio" name="goal" value={o} className="sr-only" checked={objective === o} onChange={() => change(setObjective)(o)} />
                        <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                        <span className="text-[0.82rem] leading-tight font-medium">{OBJECTIVE_LABEL[o]}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="f-start" className={label}>
                      Start date
                    </label>
                    <input id="f-start" type="date" value={startDate} onChange={(e) => pickStartDate(e.target.value)} aria-invalid={errors.dates ? true : undefined} aria-describedby="f-dates-help" className={cn(field, "mt-1.5")} />
                  </div>
                  <div>
                    <label htmlFor="f-end" className={label}>
                      End date
                    </label>
                    <input id="f-end" type="date" value={endDate} min={startDate || undefined} onChange={(e) => change(setEndDate)(e.target.value)} aria-invalid={errors.dates ? true : undefined} aria-describedby="f-dates-help" className={cn(field, "mt-1.5")} />
                  </div>
                </div>
                <p id="f-dates-help" className={cn("mt-1.5 text-[0.76rem]", errors.dates ? "font-medium text-destructive" : "text-muted-foreground")}>
                  {errors.dates ?? (steps && !editing ? "Optional. With a start date, the suggested to-dos get due dates and show on your calendar." : "Optional. Dates show on your calendar.")}
                </p>
              </div>
            </section>

            <section className={card} aria-labelledby="f-more-h">
              <button type="button" aria-expanded={more} aria-controls="f-more" onClick={() => setMore(!more)} className="flex w-full items-center justify-between gap-3 rounded-xl text-start outline-none focus-visible:ring-3 focus-visible:ring-primary/30">
                <span>
                  <span id="f-more-h" className="block font-heading text-[1rem] font-bold">
                    More details <span className="font-sans text-[0.8rem] font-normal text-muted-foreground">(optional)</span>
                  </span>
                  <span className="block text-[0.78rem] text-muted-foreground">Brand, platforms, status, budget and notes.</span>
                </span>
                <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", more && "rotate-180")} aria-hidden />
              </button>
              <div id="f-more" hidden={!more} className="mt-4 grid gap-4">
                <div>
                  <label htmlFor="f-desc" className={label}>
                    Description
                  </label>
                  <textarea id="f-desc" value={description} onChange={(e) => change(setDescription)(e.target.value)} maxLength={CAMPAIGN_DESCRIPTION_MAX} rows={2} className={cn(field, "mt-1.5 resize-y")} placeholder="What is this plan about?" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="f-brand" className={label}>
                      Brand
                    </label>
                    <BrandSelect id="f-brand" brands={brands} value={brandId} onChange={change(setBrandId)} className="mt-1.5" />
                    <p className="mt-1 text-[0.74rem] text-muted-foreground">
                      {brands.length ? (
                        "Posts in this plan will use this brand."
                      ) : (
                        <>
                          <Link href={BRAND_ROUTES.create} className="font-semibold text-primary hover:underline">
                            Create a brand
                          </Link>{" "}
                          to keep plans on-brand.
                        </>
                      )}
                    </p>
                  </div>
                  <div>
                    <label htmlFor="f-status" className={label}>
                      Status
                    </label>
                    <select
                      id="f-status"
                      value={status}
                      onChange={(e) => {
                        setStatusTouched(true);
                        change(setStatus)(e.target.value as CampaignStatus);
                      }}
                      aria-describedby="f-status-help"
                      className={cn(field, "mt-1.5")}
                    >
                      {CAMPAIGN_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                    <p id="f-status-help" className="mt-1 text-[0.74rem] text-muted-foreground">
                      {STATUS_HELP[status]} It&apos;s just a label: nothing is posted or advertised.
                    </p>
                  </div>
                </div>
                <fieldset>
                  <legend className={label}>Platforms</legend>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {SOCIAL_PROVIDER_IDS.map((p) => {
                      const on = platforms.includes(p);
                      return (
                        <label key={p} className={cn("inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[0.84rem] font-medium transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-primary/30", on ? "border-primary/50 bg-primary/[0.07] text-primary dark:text-[#c4b5ff]" : "hover:bg-muted")}>
                          <input type="checkbox" className="sr-only" checked={on} onChange={() => change(setPlatforms)(on ? platforms.filter((x) => x !== p) : [...platforms, p])} />
                          {SOCIAL_PLATFORM[p].name}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <div>
                  <label htmlFor="f-budget" className={label}>
                    Budget
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input id="f-budget" inputMode="decimal" value={budget} onChange={(e) => change(setBudget)(e.target.value)} aria-invalid={errors.budget ? true : undefined} aria-describedby="f-budget-help" className={field} placeholder="0.00" />
                    <select aria-label="Budget currency" value={currency} onChange={(e) => change(setCurrency)(e.target.value as BudgetCurrency)} className={cn(field, "w-28")}>
                      {BUDGET_CURRENCIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <p id="f-budget-help" className={cn("mt-1 text-[0.74rem]", errors.budget ? "font-medium text-destructive" : "text-muted-foreground")}>
                    {errors.budget ?? "Just for your own planning. Sociotix never spends or charges anything."}
                  </p>
                </div>
                <div>
                  <label htmlFor="f-notes" className={label}>
                    Notes
                  </label>
                  <textarea id="f-notes" value={notes} onChange={(e) => change(setNotes)(e.target.value)} maxLength={CAMPAIGN_NOTES_MAX} rows={3} className={cn(field, "mt-1.5 resize-y")} placeholder="Key messages, offers, links…" />
                </div>
              </div>
            </section>
          </div>

          <aside className="grid content-start gap-4 lg:sticky lg:top-20">
            {steps && !editing ? (
              <section className={card} aria-labelledby="f-preview">
                <h2 id="f-preview" className="font-heading text-[1rem] font-bold">
                  What you&apos;ll get
                </h2>
                <ol className="mt-2 grid gap-2.5">
                  {steps.milestones.map((m, i) => (
                    <li key={i}>
                      <p className="text-[0.84rem] font-semibold">{m.title}</p>
                      <ul className="mt-0.5 grid gap-0.5">
                        {steps.tasks
                          .filter((t) => t.milestone === i)
                          .map((t, j) => (
                            <li key={j} className="flex gap-1.5 text-[0.78rem] text-muted-foreground">
                              <span aria-hidden>○</span> {t.title}
                            </li>
                          ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              </section>
            ) : (
              <p className="flex gap-2 rounded-2xl bg-muted/50 px-4 py-3 text-[0.8rem] text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> A plan keeps your goal, to-dos and posts together. It never posts or advertises anything for you.
              </p>
            )}
            <NoticeBar notice={notice} />
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={cn(primaryButton, "flex-1")} disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Create plan"}
              </button>
              <Link href={editing ? campaignHref(campaign.id) : CAMPAIGN_ROUTES.home} className={quietButton}>
                Cancel
              </Link>
            </div>
          </aside>
        </form>
      )}
    </div>
  );
}
