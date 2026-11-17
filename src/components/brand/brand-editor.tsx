"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, CircleAlert, Copy, ImageIcon, Loader2, Save, Star, Trash2, TriangleAlert } from "lucide-react";
import { ConfirmDialog } from "@/components/dashboard/account-ui";
import { Panel } from "@/components/dashboard/shared";
import { MediaPicker, MediaThumb } from "@/components/social/content-parts";
import { page, primaryButton, quietButton, eyebrow, socialApi } from "@/components/social/parts";
import { useUnsavedWarning } from "@/components/social/publishing-parts";
import {
  BRAND_AUDIENCE_MAX,
  BRAND_DEMOGRAPHICS_MAX,
  BRAND_DESCRIPTION_MAX,
  BRAND_GUIDELINES_MAX,
  BRAND_INDUSTRY_MAX,
  BRAND_LISTS,
  BRAND_NAME_MAX,
  BRAND_ROUTES,
  BRAND_TONE_MAX,
  BRANDS_MAX,
  brandHref,
  contrastRatio,
  INDUSTRY_SUGGESTIONS,
  normalizeHex,
  normalizeWebsite,
  PERSONALITY_SUGGESTIONS,
  readableOn,
  type BrandView,
} from "@/lib/brand";
import { HASHTAGS_MAX, type MediaView } from "@/lib/social/content";
import { SOCIAL_PLATFORMS, type SocialProviderId } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";
import { BrandMark, brandField, brandLabel, TagInput } from "./brand-parts";
import type { EditorData } from "./loader";

/* -------------------------------------------------------------------------- */
/*  Form state                                                                */
/* -------------------------------------------------------------------------- */

interface Form {
  name: string;
  description: string;
  website: string;
  industry: string;
  logoMediaId: string | null;
  coverMediaId: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  personality: string[];
  toneOfVoice: string;
  audience: string;
  demographics: string;
  platforms: SocialProviderId[];
  keywords: string[];
  hashtags: string[];
  writingGuidelines: string;
  preferredPhrases: string[];
  avoidWords: string[];
}

const EMPTY: Form = {
  name: "",
  description: "",
  website: "",
  industry: "",
  logoMediaId: null,
  coverMediaId: null,
  primaryColor: "",
  secondaryColor: "",
  accentColor: "",
  personality: [],
  toneOfVoice: "",
  audience: "",
  demographics: "",
  platforms: [],
  keywords: [],
  hashtags: [],
  writingGuidelines: "",
  preferredPhrases: [],
  avoidWords: [],
};

const toForm = (b?: BrandView): Form =>
  b
    ? { name: b.name, description: b.description, website: b.website ?? "", industry: b.industry, logoMediaId: b.logoMediaId, coverMediaId: b.coverMediaId, primaryColor: b.primaryColor ?? "", secondaryColor: b.secondaryColor ?? "", accentColor: b.accentColor ?? "", personality: b.personality, toneOfVoice: b.toneOfVoice, audience: b.audience, demographics: b.demographics, platforms: b.platforms, keywords: b.keywords, hashtags: b.hashtags, writingGuidelines: b.writingGuidelines, preferredPhrases: b.preferredPhrases, avoidWords: b.avoidWords }
    : EMPTY;

/** What the form says is wrong, field by field (the server checks everything again). */
function problems(f: Form): Partial<Record<"name" | "website" | "primaryColor" | "secondaryColor" | "accentColor", string>> {
  const out: ReturnType<typeof problems> = {};
  if (!f.name.trim()) out.name = "Give the brand a name.";
  if (f.website.trim() && !normalizeWebsite(f.website)) out.website = "Enter a web address like https://example.com.";
  for (const k of ["primaryColor", "secondaryColor", "accentColor"] as const) if (f[k].trim() && !normalizeHex(f[k])) out[k] = "Use a hex color like #7047EB.";
  return out;
}

const payload = (f: Form) => ({
  name: f.name,
  description: f.description,
  website: f.website.trim() ? f.website : null,
  industry: f.industry,
  logoMediaId: f.logoMediaId,
  coverMediaId: f.coverMediaId,
  primaryColor: f.primaryColor.trim() ? f.primaryColor : null,
  secondaryColor: f.secondaryColor.trim() ? f.secondaryColor : null,
  accentColor: f.accentColor.trim() ? f.accentColor : null,
  personality: f.personality,
  toneOfVoice: f.toneOfVoice,
  audience: f.audience,
  demographics: f.demographics,
  platforms: f.platforms,
  keywords: f.keywords,
  hashtags: f.hashtags,
  writingGuidelines: f.writingGuidelines,
  preferredPhrases: f.preferredPhrases,
  avoidWords: f.avoidWords,
});

/* -------------------------------------------------------------------------- */
/*  Editor                                                                    */
/* -------------------------------------------------------------------------- */

type Notice = { ok: boolean; text: string; stale?: boolean } | null;

export function BrandEditor({ brand, count, media }: EditorData) {
  const router = useRouter();
  const created = useSearchParams().get("created") === "1";
  const [saved, setSaved] = React.useState<Form>(() => toForm(brand));
  const [form, setForm] = React.useState<Form>(() => toForm(brand));
  const [version, setVersion] = React.useState(brand?.version ?? 1);
  const [isDefault, setIsDefault] = React.useState(brand?.isDefault ?? false);
  const [library, setLibrary] = React.useState<MediaView[]>(media);
  const [picking, setPicking] = React.useState<null | "logo" | "cover">(null);
  const [busy, setBusy] = React.useState<null | "save" | "default" | "duplicate" | "delete">(null);
  const [notice, setNotice] = React.useState<Notice>(created && brand ? { ok: true, text: "Brand created." } : null);
  const [tried, setTried] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const inFlight = React.useRef(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  useUnsavedWarning(dirty && busy === null);
  const bad = problems(form);
  const blocked = Object.keys(bad).length > 0;
  const atLimit = !brand && count >= BRANDS_MAX;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (notice?.ok) setNotice(null);
  };

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (inFlight.current || busy) return;
    setTried(true);
    if (blocked) return setNotice({ ok: false, text: "Fix the highlighted fields, then save again." });
    inFlight.current = true;
    setBusy("save");
    setNotice(null);
    const body = payload(form);
    const r = brand
      ? await socialApi<{ brand: BrandView }>(`/api/brands/${brand.id}`, { method: "PATCH", body: JSON.stringify({ ...body, expectedVersion: version }) })
      : await socialApi<{ brand: BrandView }>("/api/brands", { method: "POST", body: JSON.stringify(body) });
    inFlight.current = false;
    setBusy(null);
    if (!r.ok) return setNotice({ ok: false, text: r.message, stale: /changed somewhere else/i.test(r.message) });
    if (!brand) {
      setSaved(form);
      return router.replace(`${brandHref(r.data.brand.id)}?created=1`);
    }
    const next = toForm(r.data.brand);
    setSaved(next);
    setForm(next);
    setVersion(r.data.brand.version);
    setNotice({ ok: true, text: "Brand saved." });
    router.refresh();
  }

  async function manage(kind: "default" | "duplicate") {
    if (!brand || inFlight.current || busy) return;
    inFlight.current = true;
    setBusy(kind);
    setNotice(null);
    const r = await socialApi<{ brand?: BrandView }>(`/api/brands/${brand.id}/${kind}`, { method: "POST" });
    inFlight.current = false;
    setBusy(null);
    if (!r.ok) return setNotice({ ok: false, text: r.message });
    if (kind === "default") {
      setIsDefault(true);
      setNotice({ ok: true, text: "This is now your default brand." });
      router.refresh();
    } else router.push(brandHref(r.data.brand!.id));
  }

  async function remove() {
    if (!brand || inFlight.current) return;
    inFlight.current = true;
    setBusy("delete");
    const r = await socialApi(`/api/brands/${brand.id}`, { method: "DELETE" });
    inFlight.current = false;
    if (!r.ok) {
      setBusy(null);
      return setNotice({ ok: false, text: r.message });
    }
    setSaved(form); // nothing left to warn about
    router.push(BRAND_ROUTES.kit);
  }

  const pickerOf = picking === "logo" ? form.logoMediaId : form.coverMediaId;

  return (
    <div className={page}>
      <Link href={BRAND_ROUTES.kit} className="inline-flex items-center gap-1.5 rounded text-[0.82rem] font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40">
        <ArrowLeft className="size-4" aria-hidden /> Brand Kit
      </Link>
      <header className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={cn(eyebrow, "text-primary")}>{brand ? "Edit brand" : "New brand"}</p>
          <h1 className="mt-1 truncate font-heading text-[1.6rem] leading-tight font-extrabold tracking-tight sm:text-[1.9rem]">{brand ? saved.name || "Untitled brand" : "Create a brand"}</h1>
          {isDefault ? (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-lime/70 px-2 py-0.5 text-[0.7rem] font-bold text-[#1b2400]">
              <Star className="size-3 fill-current" aria-hidden /> Default brand
            </p>
          ) : null}
        </div>
        <button type="submit" form="brand-form" className={primaryButton} disabled={busy !== null || atLimit || (!!brand && !dirty)}>
          {busy === "save" ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Save className="size-4" aria-hidden />} {brand ? "Save changes" : "Create brand"}
        </button>
      </header>

      <div aria-live="polite" className="mt-3 min-h-0">
        {atLimit ? (
          <p role="alert" className="flex items-start gap-2 rounded-2xl bg-destructive/[0.08] px-4 py-3 text-[0.85rem] font-medium text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> You&apos;ve reached the limit of {BRANDS_MAX} brands. Delete one you no longer use to add another.
          </p>
        ) : notice ? (
          <div role={notice.ok ? "status" : "alert"} className={cn("flex flex-wrap items-start gap-x-3 gap-y-2 rounded-2xl px-4 py-3 text-[0.85rem] font-medium", notice.ok ? "bg-secondary text-secondary-foreground" : "bg-destructive/[0.08] text-destructive")}>
            <span className="flex min-w-0 flex-1 items-start gap-2">
              {notice.ok ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
              <span>{notice.text}</span>
            </span>
            {notice.stale ? (
              <button type="button" className="font-semibold underline underline-offset-2" onClick={() => window.location.reload()}>
                Reload latest
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
        <form id="brand-form" onSubmit={save} noValidate className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
          {/* Identity */}
          <Section id="identity" title="Brand identity" description="Who the brand is and how people recognise it.">
            <Field id="brand-name" label="Brand or business name" error={tried ? bad.name : undefined} required>
              <input id="brand-name" value={form.name} maxLength={BRAND_NAME_MAX} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Bean & Leaf Café" aria-invalid={tried && bad.name ? true : undefined} aria-describedby="brand-name-help" className={cn(brandField, "mt-1.5")} autoComplete="organization" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="brand-industry" label="Industry">
                <input id="brand-industry" list="brand-industries" value={form.industry} maxLength={BRAND_INDUSTRY_MAX} onChange={(e) => set("industry", e.target.value)} placeholder="e.g. Food & beverage" className={cn(brandField, "mt-1.5")} />
                <datalist id="brand-industries">
                  {INDUSTRY_SUGGESTIONS.map((i) => (
                    <option key={i} value={i} />
                  ))}
                </datalist>
              </Field>
              <Field id="brand-website" label="Website" error={bad.website && (tried || form.website.length > 3) ? bad.website : undefined}>
                <input id="brand-website" type="url" inputMode="url" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://example.com" aria-invalid={bad.website && tried ? true : undefined} className={cn(brandField, "mt-1.5")} autoComplete="url" />
              </Field>
            </div>
            <Field id="brand-description" label="Description" help={`${form.description.length}/${BRAND_DESCRIPTION_MAX}`}>
              <textarea id="brand-description" rows={3} value={form.description} maxLength={BRAND_DESCRIPTION_MAX} onChange={(e) => set("description", e.target.value)} placeholder="What the brand does, in a sentence or two." className={cn(brandField, "mt-1.5 resize-y")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageField label="Logo" mediaId={form.logoMediaId} onChoose={() => setPicking("logo")} onRemove={() => set("logoMediaId", null)} square />
              <ImageField label="Cover image (optional)" mediaId={form.coverMediaId} onChoose={() => setPicking("cover")} onRemove={() => set("coverMediaId", null)} />
            </div>
          </Section>

          {/* Colors */}
          <Section id="colors" title="Brand colors" description="Used in previews and badges across Sociotix. Hex values only.">
            <div className="grid gap-4 sm:grid-cols-3">
              <ColorField id="brand-primary" label="Primary" value={form.primaryColor} error={bad.primaryColor && (tried || form.primaryColor.length > 6) ? bad.primaryColor : undefined} onChange={(v) => set("primaryColor", v)} />
              <ColorField id="brand-secondary" label="Secondary" value={form.secondaryColor} error={bad.secondaryColor && (tried || form.secondaryColor.length > 6) ? bad.secondaryColor : undefined} onChange={(v) => set("secondaryColor", v)} />
              <ColorField id="brand-accent" label="Accent" value={form.accentColor} error={bad.accentColor && (tried || form.accentColor.length > 6) ? bad.accentColor : undefined} onChange={(v) => set("accentColor", v)} />
            </div>
          </Section>

          {/* Audience */}
          <Section id="audience" title="Audience" description="Who the brand speaks to and where.">
            <Field id="brand-audience" label="Target audience" help={`${form.audience.length}/${BRAND_AUDIENCE_MAX}`}>
              <textarea id="brand-audience" rows={3} value={form.audience} maxLength={BRAND_AUDIENCE_MAX} onChange={(e) => set("audience", e.target.value)} placeholder="e.g. Students and remote workers who want a calm place to focus." className={cn(brandField, "mt-1.5 resize-y")} />
            </Field>
            <Field id="brand-demographics" label="Demographics" help={`${form.demographics.length}/${BRAND_DEMOGRAPHICS_MAX}`}>
              <textarea id="brand-demographics" rows={2} value={form.demographics} maxLength={BRAND_DEMOGRAPHICS_MAX} onChange={(e) => set("demographics", e.target.value)} placeholder="e.g. Ages 18–35, city dwellers, UK and Ireland." className={cn(brandField, "mt-1.5 resize-y")} />
            </Field>
            <fieldset>
              <legend className={brandLabel}>Preferred social platforms</legend>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {SOCIAL_PLATFORMS.map((p) => {
                  const on = form.platforms.includes(p.id);
                  return (
                    <button key={p.id} type="button" aria-pressed={on} onClick={() => set("platforms", on ? form.platforms.filter((x) => x !== p.id) : [...form.platforms, p.id])} className={cn("inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-[0.82rem] font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-primary/30", on ? "border-primary bg-secondary text-primary dark:text-[#c9bcff]" : "bg-card text-muted-foreground hover:bg-muted")}>
                      {on ? <Check className="size-3.5" aria-hidden /> : null} {p.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <TagInput id="brand-keywords" label="Brand keywords" value={form.keywords} onChange={(v) => set("keywords", v)} max={BRAND_LISTS.keywords.max} maxEach={BRAND_LISTS.keywords.each} placeholder="e.g. specialty coffee" help="Topics the brand is about. Press Enter to add." />
            <TagInput
              id="brand-hashtags"
              label="Brand hashtags"
              value={form.hashtags}
              onChange={(v) => set("hashtags", v)}
              max={HASHTAGS_MAX}
              maxEach={50}
              prefix="#"
              placeholder="e.g. beanandleaf"
              help="Letters, numbers and underscores. You can add them to drafts in one click."
              normalize={(s) => s.trim().replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "")}
            />
          </Section>

          {/* Voice */}
          <Section id="voice" title="Voice and writing guidelines" description="How the brand sounds. These show beside your drafts and are kept ready for the AI tools.">
            <div>
              <TagInput id="brand-personality" label="Brand personality" value={form.personality} onChange={(v) => set("personality", v)} max={BRAND_LISTS.personality.max} maxEach={BRAND_LISTS.personality.each} placeholder="e.g. Warm" help="A few traits, such as Friendly or Bold." />
              <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Suggested traits">
                {PERSONALITY_SUGGESTIONS.filter((s) => !form.personality.some((p) => p.toLowerCase() === s.toLowerCase())).map((s) => (
                  <button key={s} type="button" disabled={form.personality.length >= BRAND_LISTS.personality.max} onClick={() => set("personality", [...form.personality, s])} className="h-8 rounded-full border border-dashed px-2.5 text-[0.76rem] text-muted-foreground outline-none transition-colors hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40">
                    + {s}
                  </button>
                ))}
              </div>
            </div>
            <Field id="brand-tone" label="Tone of voice" help={`${form.toneOfVoice.length}/${BRAND_TONE_MAX}`}>
              <textarea id="brand-tone" rows={3} value={form.toneOfVoice} maxLength={BRAND_TONE_MAX} onChange={(e) => set("toneOfVoice", e.target.value)} placeholder="e.g. Friendly and relaxed. Talks like a barista who remembers your order." className={cn(brandField, "mt-1.5 resize-y")} />
            </Field>
            <Field id="brand-guidelines" label="Writing guidelines" help={`${form.writingGuidelines.length}/${BRAND_GUIDELINES_MAX}`}>
              <textarea id="brand-guidelines" rows={4} value={form.writingGuidelines} maxLength={BRAND_GUIDELINES_MAX} onChange={(e) => set("writingGuidelines", e.target.value)} placeholder="e.g. Short sentences. One emoji at most. Always end with a question." className={cn(brandField, "mt-1.5 resize-y")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <TagInput id="brand-phrases" label="Preferred phrases" value={form.preferredPhrases} onChange={(v) => set("preferredPhrases", v)} max={BRAND_LISTS.preferredPhrases.max} maxEach={BRAND_LISTS.preferredPhrases.each} placeholder="e.g. Fresh from the roaster" />
              <TagInput id="brand-avoid" label="Words to avoid" value={form.avoidWords} onChange={(v) => set("avoidWords", v)} max={BRAND_LISTS.avoidWords.max} maxEach={BRAND_LISTS.avoidWords.each} placeholder="e.g. cheap" help="You'll get a warning if a draft uses one." />
            </div>
          </Section>

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className={primaryButton} disabled={busy !== null || atLimit || (!!brand && !dirty)}>
              {busy === "save" ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Save className="size-4" aria-hidden />} {brand ? "Save changes" : "Create brand"}
            </button>
            <Link href={BRAND_ROUTES.kit} className={quietButton}>
              {dirty ? "Discard" : "Back"}
            </Link>
            {dirty ? <span className="text-[0.78rem] text-muted-foreground">You have unsaved changes.</span> : null}
          </div>

          {brand ? (
            <Panel className="p-4 sm:p-5" aria-labelledby="manage-brand">
              <h2 id="manage-brand" className="font-heading text-[1rem] font-extrabold">
                Manage this brand
              </h2>
              <p className="mt-1 text-[0.8rem] text-muted-foreground">Deleting a brand keeps every draft and image. Drafts simply lose the brand label.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!isDefault ? (
                  <button type="button" className={quietButton} disabled={busy !== null || dirty} onClick={() => void manage("default")}>
                    <Star className="size-4" aria-hidden /> Set as default
                  </button>
                ) : null}
                <button type="button" className={quietButton} disabled={busy !== null || dirty || count >= BRANDS_MAX} onClick={() => void manage("duplicate")}>
                  <Copy className="size-4" aria-hidden /> Duplicate
                </button>
                <button type="button" className={cn(quietButton, "text-destructive")} disabled={busy !== null} onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="size-4" aria-hidden /> Delete
                </button>
              </div>
              {dirty ? <p className="mt-2 text-[0.74rem] text-muted-foreground">Save your changes first to duplicate or change the default.</p> : null}
            </Panel>
          ) : null}
        </form>

        <aside className="order-1 min-w-0 lg:sticky lg:top-4 lg:order-2" aria-label="Live preview">
          <BrandPreview form={form} />
        </aside>
      </div>

      <MediaPicker
        key={picking ?? "closed"}
        open={picking !== null}
        onOpenChange={(o) => !o && setPicking(null)}
        library={library}
        onLibraryChange={setLibrary}
        selected={pickerOf ? [pickerOf] : []}
        onChange={(ids) => {
          set(picking === "logo" ? "logoMediaId" : "coverMediaId", ids[0] ?? null);
          if (ids[0]) setPicking(null);
        }}
        max={1}
        single
        title={picking === "logo" ? "Choose a logo" : "Choose a cover image"}
        description="Pick from your media library or upload a JPEG, PNG or WebP image (up to 5 MB). The image is checked on upload and stays private to your account."
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={brand ? `Delete ${brand.name}?` : "Delete brand?"}
        description={brand && brand.postCount > 0 ? `${brand.postCount} ${brand.postCount === 1 ? "draft uses" : "drafts use"} this brand. They keep all their content and simply have no brand afterwards. Your images stay in your media library.` : "No drafts use this brand. Your images stay in your media library."}
        confirmLabel="Delete brand"
        tone="danger"
        icon={Trash2}
        onConfirm={() => {
          setConfirmDelete(false);
          void remove();
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pieces                                                                    */
/* -------------------------------------------------------------------------- */

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <Panel className="p-4 sm:p-5" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="font-heading text-[1.05rem] font-extrabold">
        {title}
      </h2>
      <p className="mt-0.5 text-[0.8rem] text-muted-foreground">{description}</p>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </Panel>
  );
}

function Field({ id, label, error, help, required, children }: { id: string; label: string; error?: string; help?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={brandLabel}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      {children}
      <p id={`${id}-help`} className={cn("mt-1 min-h-[1em] text-[0.74rem]", error ? "font-medium text-destructive" : "text-muted-foreground")} role={error ? "alert" : undefined}>
        {error ?? help ?? ""}
      </p>
    </div>
  );
}

function ColorField({ id, label, value, onChange, error }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string }) {
  const hex = normalizeHex(value);
  const low = hex && contrastRatio(hex, "#ffffff") < 3;
  return (
    <div>
      <label htmlFor={id} className={brandLabel}>
        {label} color
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <input type="color" aria-label={`Pick the ${label.toLowerCase()} color`} value={hex ?? "#7047eb"} onChange={(e) => onChange(e.target.value)} className="size-11 shrink-0 cursor-pointer rounded-xl border bg-background p-1 sm:size-10" />
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder="#7047EB" maxLength={7} spellCheck={false} autoCapitalize="characters" aria-invalid={error ? true : undefined} aria-describedby={`${id}-help`} className={cn(brandField, "min-w-0 font-mono uppercase")} />
        {value ? (
          <button type="button" onClick={() => onChange("")} className="shrink-0 rounded text-[0.76rem] font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40">
            Clear
          </button>
        ) : null}
      </div>
      <p id={`${id}-help`} className={cn("mt-1 text-[0.74rem]", error ? "font-medium text-destructive" : "text-muted-foreground")} role={error ? "alert" : undefined}>
        {error ?? (low ? "Light on white: fine for fills, harder to read as text." : value ? "" : "Optional.")}
      </p>
    </div>
  );
}

function ImageField({ label, mediaId, onChoose, onRemove, square }: { label: string; mediaId: string | null; onChoose: () => void; onRemove: () => void; square?: boolean }) {
  return (
    <div>
      <p className={brandLabel}>{label}</p>
      <div className="mt-1.5 flex items-center gap-3">
        <div className={cn("grid shrink-0 place-items-center overflow-hidden rounded-2xl border bg-muted/50", square ? "size-20" : "h-20 w-32")}>
          {mediaId ? <MediaThumb id={mediaId} name={`${label} preview`} className={square ? "object-contain p-1" : "object-cover"} /> : <ImageIcon className="size-6 text-muted-foreground" aria-hidden />}
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <button type="button" className={cn(quietButton, "h-9 px-3 text-[0.8rem] sm:h-9")} onClick={onChoose}>
            {mediaId ? "Change" : "Choose or upload"}
          </button>
          {mediaId ? (
            <button type="button" className="rounded text-[0.76rem] font-semibold text-muted-foreground outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-primary/40" onClick={onRemove}>
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** What the brand looks like in Sociotix, updated as the form changes. Headings use Manrope and body text Inter, as everywhere in Sociotix. */
function BrandPreview({ form }: { form: Form }) {
  const primary = normalizeHex(form.primaryColor);
  const secondary = normalizeHex(form.secondaryColor);
  const accent = normalizeHex(form.accentColor);
  const base = primary ?? "#7047eb";
  const name = form.name.trim() || "Your brand";
  const website = normalizeWebsite(form.website);
  return (
    <Panel className="overflow-hidden" aria-label="Brand preview">
      <div className="relative h-24 overflow-hidden" style={{ backgroundColor: secondary ?? base }}>
        {form.coverMediaId ? <MediaThumb id={form.coverMediaId} name="" className="absolute inset-0" /> : null}
        <span className="absolute inset-x-0 bottom-0 flex h-1.5" aria-hidden>
          {[primary, secondary, accent].map((c, i) => (
            <span key={i} className="flex-1" style={{ backgroundColor: c ?? "transparent" }} />
          ))}
        </span>
      </div>
      <div className="px-4 pb-4">
        <BrandMark brand={{ name, primaryColor: primary, logoMediaId: form.logoMediaId }} className="-mt-8 size-16 rounded-2xl border-2 border-card text-xl shadow-soft" />
        <div className="mt-2 flex items-end gap-3">
          <div className="min-w-0">
            <p className="truncate font-heading text-[1.1rem] leading-tight font-extrabold">{name}</p>
            <p className="truncate text-[0.76rem] text-muted-foreground">{[form.industry.trim(), website?.replace(/^https?:\/\//, "")].filter(Boolean).join(" · ") || "Industry and website"}</p>
          </div>
        </div>
        <p className="mt-3 text-[0.84rem] leading-relaxed whitespace-pre-line text-muted-foreground">{form.description.trim() || "Your description appears here."}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex h-9 items-center rounded-full px-4 text-[0.8rem] font-bold" style={{ backgroundColor: base, color: readableOn(base) }}>
            Primary button
          </span>
          {secondary ? (
            <span className="inline-flex h-9 items-center rounded-full border px-4 text-[0.8rem] font-bold" style={{ backgroundColor: secondary, color: readableOn(secondary) }}>
              Secondary
            </span>
          ) : null}
          {accent ? (
            <span className="inline-flex h-9 items-center rounded-full px-4 text-[0.8rem] font-bold" style={{ backgroundColor: accent, color: readableOn(accent) }}>
              Accent
            </span>
          ) : null}
        </div>

        {form.personality.length ? (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Personality">
            {form.personality.map((p) => (
              <li key={p} className="rounded-full border px-2.5 py-0.5 text-[0.72rem]" style={{ borderColor: base }}>
                {p}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 rounded-2xl border bg-background p-3.5">
          <p className="text-[0.66rem] font-bold tracking-wider text-muted-foreground uppercase">Sample post</p>
          <p className="mt-1.5 font-heading text-[0.98rem] leading-snug font-extrabold">
            <span className="me-1.5 inline-block h-3 w-1.5 rounded-sm align-[-1px]" style={{ backgroundColor: accent ?? base }} aria-hidden />
            {form.toneOfVoice.trim() ? "Say it your way" : "A headline in Manrope"}
          </p>
          <p className="mt-1 text-[0.82rem] leading-relaxed text-muted-foreground">{form.toneOfVoice.trim() ? form.toneOfVoice.trim().slice(0, 140) : "Body text is set in Inter, so drafts read the same everywhere in Sociotix."}</p>
          {form.hashtags.length ? (
            <p className="mt-2 text-[0.78rem] font-medium break-words" style={{ color: base }}>
              {form.hashtags.slice(0, 6).map((t) => `#${t}`).join(" ")}
            </p>
          ) : null}
        </div>

        {primary && contrastRatio(primary, "#ffffff") < 3 ? (
          <p className="mt-3 flex items-start gap-1.5 text-[0.74rem] text-muted-foreground">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> This primary color is light, so Sociotix shows dark text on it.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
