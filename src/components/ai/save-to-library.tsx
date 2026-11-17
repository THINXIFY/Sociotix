"use client";

import * as React from "react";
import Link from "next/link";
import { BookmarkPlus, Check, Loader2 } from "lucide-react";
import { BrandSelect } from "@/components/brand/brand-parts";
import { fieldClass, labelClass } from "@/components/social/content-parts";
import type { BrandSummary } from "@/lib/brand";
import { primaryButton, quietButton } from "@/components/social/parts";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AI_SAVE_SOURCES, CONTENT_ROUTES, HASHTAGS_MAX, NOTES_MAX, parseHashtags, providerFromName, TEMPLATE_NAME_MAX, type AiSaveSource } from "@/lib/social/content";
import { SOCIAL_PLATFORMS, type SocialProviderId } from "@/lib/social/platforms";
import { charCount, POST_TEXT_MAX, postHref, PUBLISH_RULES } from "@/lib/social/publishing";
import { browserTimeZone } from "@/lib/social/time";
import { cn } from "@/lib/utils";
import { useBrandSelection } from "./brand-selection";

/*
 * "Save to Library" for AI tool results (CM-03). It appears only next to a result that is really on screen, and
 * saves what is there (including the customer's own edits): social-content results become drafts in the Content
 * Library, a hashtag set becomes a template. The customer reviews and edits the title, text, platforms and folder
 * first. It never plans, schedules or publishes anything, and it needs a signed-in account.
 */

export interface SaveItem {
  title?: string;
  text?: string;
  /** Private notes kept with the draft (for example an idea's outline). */
  notes?: string;
  /** The platform as the AI tool names it ("Instagram"); mapped to Sociotix's own where one exists. */
  platform?: string;
  hashtags?: string[];
}

type Done = { kind: "draft" | "template"; created: { id: string; name: string }[]; duplicates: { id: string; name: string }[]; skipped: { index: number; reason: string }[] };
type Problem = { kind: "signed-out" | "error"; message: string };

const jsonFetch = async (path: string, init?: RequestInit) => {
  const res = await fetch(path, { ...init, headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) } });
  const json = await res.json().catch(() => null);
  return { res, json };
};

export function SaveToLibrary({
  source,
  items,
  label,
  variant = "icon",
  children,
  className,
}: {
  source: AiSaveSource;
  items: SaveItem[];
  /** Accessible name of the button (what exactly is being saved). */
  label: string;
  variant?: "icon" | "text";
  children?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [done, setDone] = React.useState<Done | null>(null);
  const saved = !!done && done.created.length + done.duplicates.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={saved ? "Saved to your Content Library" : label}
        className={cn(
          variant === "icon"
            ? "relative inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
            : "relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-semibold transition-colors after:absolute after:-inset-y-1.5 after:inset-x-0 hover:bg-muted focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none",
          saved && "text-primary",
          className,
        )}
      >
        {saved ? <Check className="size-3.5" aria-hidden /> : <BookmarkPlus className="size-3.5" aria-hidden />}
        {variant === "text" ? (saved ? "Saved" : (children ?? "Save to Library")) : null}
      </button>
      {/* The dialog is only built when it is open, so each opening starts from the result as it is now. */}
      {open ? <SaveDialog source={source} items={items} done={done} onDone={setDone} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function SaveDialog({ source, items, done, onDone, onClose }: { source: AiSaveSource; items: SaveItem[]; done: Done | null; onDone: (d: Done) => void; onClose: () => void }) {
  const meta = AI_SAVE_SOURCES[source];
  const template = meta.kind === "template";
  const many = items.length > 1;
  const first = items[0] ?? {};
  const [title, setTitle] = React.useState(first.title ?? "");
  const [text, setText] = React.useState(template ? (first.hashtags ?? []).join(" ") : (first.text ?? ""));
  const [notes, setNotes] = React.useState(first.notes ?? "");
  const mapped = providerFromName(first.platform);
  const [providers, setProviders] = React.useState<SocialProviderId[]>(mapped ? [mapped] : []);
  const [folderId, setFolderId] = React.useState("");
  const selected = useBrandSelection();
  const [brandId, setBrandId] = React.useState<string | null>(template ? null : selected.brandId);
  const [brands, setBrands] = React.useState<BrandSummary[]>([]);
  const [folders, setFolders] = React.useState<{ id: string; name: string }[] | null>(null);
  const [problem, setProblem] = React.useState<Problem | null>(null);
  const [busy, setBusy] = React.useState(false);
  const inFlight = React.useRef(false);

  // The customer's folders (also tells a signed-out visitor, before they edit anything, that saving needs an account).
  React.useEffect(() => {
    if (done || template) return;
    let live = true;
    jsonFetch("/api/content/folders")
      .then(({ res, json }) => {
        if (!live) return;
        if (res.status === 401) setProblem({ kind: "signed-out", message: "Sign in to save results to your Content Library." });
        else if (res.ok) setFolders(json.folders);
        else setFolders([]);
      })
      .catch(() => live && setFolders([]));
    return () => {
      live = false;
    };
  }, [done, template]);

  // The customer's brands (drafts can be filed under one; a hashtag template has no brand). A brand that is gone is ignored.
  React.useEffect(() => {
    if (done || template) return;
    let live = true;
    fetch("/api/brands")
      .then(async (r) => (r.ok ? ((await r.json()) as { brands: BrandSummary[] }).brands : []))
      .then((list) => {
        if (!live) return;
        setBrands(list);
        setBrandId((cur) => (cur && list.some((b) => b.id === cur) ? cur : null));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [done, template]);

  const parsed = parseHashtags(template ? text : "");
  const draftText = many ? "" : text;
  const limit = providers.length ? Math.min(POST_TEXT_MAX, ...providers.map((p) => PUBLISH_RULES[p].textMax)) : POST_TEXT_MAX;
  const used = charCount(draftText);
  const nothing = template ? !parsed.tags.length || !title.trim() : many ? false : !text.trim();
  const unmapped = first.platform && !mapped && !many ? first.platform : null;

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (inFlight.current || nothing || problem?.kind === "signed-out") return;
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    const payload = template
      ? [{ title, text: "", hashtags: parsed.tags.slice(0, HASHTAGS_MAX), providers }]
      : many
        ? items.map((it) => ({ title: it.title ?? "", text: it.text ?? "", notes: it.notes ?? "", providers: (providerFromName(it.platform) ? [providerFromName(it.platform)!] : []) as string[], hashtags: it.hashtags ?? [] }))
        : [{ title, text, notes, providers, hashtags: first.hashtags ?? [] }];
    try {
      const { res, json } = await jsonFetch("/api/content/import", { method: "POST", body: JSON.stringify({ source, kind: meta.kind, folderId: folderId || null, ...(template ? {} : { brandId }), timezone: browserTimeZone(), items: payload }) });
      if (res.ok) onDone(json as Done);
      else if (res.status === 401) setProblem({ kind: "signed-out", message: "Your session has ended. Sign in again to save this." });
      else setProblem({ kind: "error", message: json?.error?.issues?.[0]?.message ?? json?.error?.message ?? "Couldn't save. Please try again." });
    } catch {
      setProblem({ kind: "error", message: "We couldn't reach Sociotix. Check your connection and try again. Nothing was saved." });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const togglePlatform = (id: SocialProviderId) => setProviders((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
        {done ? (
          <Saved done={done} many={many} onClose={onClose} />
        ) : (
          <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
            <div className="border-b px-5 pt-5 pb-4">
              <DialogTitle className="font-heading text-lg font-extrabold">{template ? "Save hashtags as a template" : many ? `Save ${items.length} drafts to your Library` : "Save to your Content Library"}</DialogTitle>
              <DialogDescription className="mt-1 text-[0.82rem] text-muted-foreground">
                {template ? "A reusable hashtag set you can add to any post. Nothing is posted." : "Saved as an editable draft from " + meta.label + ". You can edit it, then plan it on your calendar. Nothing is posted."}
              </DialogDescription>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {problem?.kind === "signed-out" ? (
                <p role="alert" className="rounded-2xl bg-primary/[0.07] px-4 py-3 text-sm dark:bg-primary/15">
                  <span className="font-semibold">{problem.message}</span>{" "}
                  <Link href="/login" className="font-semibold text-primary underline-offset-2 hover:underline">
                    Sign in
                  </Link>
                  . Copy the result first if you need to keep it before you leave this page.
                </p>
              ) : null}

              {many ? (
                <ul tabIndex={0} className="max-h-60 space-y-1.5 overflow-y-auto rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-primary/30" aria-label="Drafts to save">
                  {items.map((it, i) => (
                    <li key={i} className="rounded-xl border bg-card px-3 py-2">
                      <p className="truncate text-[0.82rem] font-semibold">{it.title || `Draft ${i + 1}`}</p>
                      <p className="line-clamp-2 text-[0.75rem] text-muted-foreground">{it.text}</p>
                      {it.platform ? <p className="mt-0.5 text-[0.68rem] font-semibold text-muted-foreground">{it.platform}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <>
                  <label className="block">
                    <span className={labelClass}>{template ? "Template name" : "Title"} {template ? null : <span className="font-normal text-muted-foreground">(optional, only you see it)</span>}</span>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={template ? TEMPLATE_NAME_MAX : 100} className={cn(fieldClass, "mt-1.5")} placeholder={template ? "e.g. Product launch hashtags" : "e.g. Autumn launch"} />
                  </label>
                  <label className="block">
                    <span className={labelClass}>{template ? "Hashtags" : "Content"}</span>
                    <textarea value={text} onChange={(e) => setText(e.target.value)} rows={template ? 3 : 7} className={cn(fieldClass, "mt-1.5 resize-y leading-relaxed")} spellCheck={!template} aria-describedby="save-count" />
                    {template ? (
                      <span id="save-count" className={cn("mt-1 block text-[0.72rem]", parsed.invalid.length || parsed.tags.length > HASHTAGS_MAX ? "font-semibold text-destructive" : "text-muted-foreground")}>
                        {parsed.invalid.length ? `Left out: ${parsed.invalid.slice(0, 3).join(", ")}.` : parsed.tags.length > HASHTAGS_MAX ? `Templates hold up to ${HASHTAGS_MAX} hashtags; the first ${HASHTAGS_MAX} are saved.` : `${parsed.tags.length} / ${HASHTAGS_MAX} hashtags`}
                      </span>
                    ) : (
                      <span id="save-count" className={cn("mt-1 flex justify-between gap-3 text-[0.72rem]", used > limit ? "font-semibold text-destructive" : "text-muted-foreground")} aria-live="polite">
                        <span>{used > limit ? "Over the limit for the selected platforms. You can save it and shorten it in the editor." : " "}</span>
                        <span className="tabular-nums">
                          {used.toLocaleString("en-US")} / {limit.toLocaleString("en-US")}
                        </span>
                      </span>
                    )}
                  </label>
                  {!template && first.notes !== undefined ? (
                    <label className="block">
                      <span className={labelClass}>
                        Notes <span className="font-normal text-muted-foreground">(kept private with the draft)</span>
                      </span>
                      <textarea value={notes} maxLength={NOTES_MAX - 80} onChange={(e) => setNotes(e.target.value)} rows={3} className={cn(fieldClass, "mt-1.5 resize-y leading-relaxed")} />
                    </label>
                  ) : null}
                  <div>
                    <p className={labelClass}>
                      Platforms <span className="font-normal text-muted-foreground">(optional)</span>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Platforms">
                      {SOCIAL_PLATFORMS.map((p) => {
                        const on = providers.includes(p.id);
                        return (
                          <button key={p.id} type="button" aria-pressed={on} onClick={() => togglePlatform(p.id)} className={cn("h-9 rounded-full border px-3 text-[0.78rem] font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary/30", on ? "border-primary/30 bg-primary/10 text-primary dark:bg-primary/20 dark:text-[#c4b5ff]" : "text-muted-foreground hover:bg-muted")}>
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                    {unmapped ? <p className="mt-1.5 text-[0.72rem] text-muted-foreground">{unmapped} isn&apos;t a platform Sociotix plans for yet. Choose one above, or leave it empty.</p> : null}
                  </div>
                </>
              )}

              {!template ? (
                <label className="block">
                  <span className={labelClass}>
                    Folder <span className="font-normal text-muted-foreground">(optional)</span>
                  </span>
                  <select value={folderId} onChange={(e) => setFolderId(e.target.value)} disabled={folders === null && problem?.kind !== "signed-out"} className={cn(fieldClass, "mt-1.5")}>
                    <option value="">{folders === null ? "Loading folders…" : "No folder"}</option>
                    {(folders ?? []).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {!template && brands.length ? (
                <label className="block">
                  <span className={labelClass}>
                    Brand <span className="font-normal text-muted-foreground">(optional)</span>
                  </span>
                  <BrandSelect brands={brands} value={brandId} onChange={setBrandId} className="mt-1.5" />
                </label>
              ) : null}

              {problem?.kind === "error" ? (
                <p role="alert" className="rounded-2xl bg-destructive/[0.07] px-4 py-3 text-sm font-medium text-destructive">
                  {problem.message}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-3.5">
              <button type="button" className={quietButton} onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className={primaryButton} disabled={busy || nothing || problem?.kind === "signed-out"}>
                {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <BookmarkPlus className="size-4" aria-hidden />}
                {busy ? "Saving…" : template ? "Save template" : many ? `Save ${items.length} drafts` : "Save draft"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Saved({ done, many, onClose }: { done: Done; many: boolean; onClose: () => void }) {
  const total = done.created.length + done.duplicates.length;
  const only = !many && total === 1 ? (done.created[0] ?? done.duplicates[0]) : null;
  return (
    <div className="p-6">
      <span className="mb-4 grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary dark:bg-primary/20" aria-hidden>
        <Check className="size-5" />
      </span>
      <DialogTitle className="font-heading text-lg font-extrabold">{total ? (done.kind === "template" ? "Saved as a template" : many ? `${done.created.length} ${done.created.length === 1 ? "draft" : "drafts"} saved` : "Saved to your Library") : "Nothing was saved"}</DialogTitle>
      <DialogDescription className="mt-1.5 text-sm leading-relaxed text-muted-foreground" role="status">
        {done.duplicates.length && !done.created.length ? "You already saved this a moment ago, so no second copy was made." : done.kind === "template" ? "Find it under Templates in your Content Library, or choose “Use a template” in the post editor." : "It is an editable draft. Edit it, then plan it on your calendar whenever you like. Nothing is posted."}
        {done.created.length && done.duplicates.length ? ` ${done.duplicates.length} ${done.duplicates.length === 1 ? "was" : "were"} already saved and skipped.` : ""}
      </DialogDescription>
      {done.skipped.length ? (
        <ul className="mt-3 space-y-1 rounded-2xl bg-destructive/[0.07] px-4 py-3 text-[0.8rem] font-medium text-destructive" role="alert">
          {done.skipped.slice(0, 4).map((s) => (
            <li key={s.index}>
              Item {s.index + 1}: {s.reason}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className={quietButton} onClick={onClose}>
          Done
        </button>
        {done.kind === "draft" && total ? (
          <Link href="/dashboard/social/calendar" className={quietButton}>
            Plan on calendar
          </Link>
        ) : null}
        <Link href={only && done.kind === "draft" ? postHref(only.id) : CONTENT_ROUTES.library} className={primaryButton}>
          {only && done.kind === "draft" ? "Open draft" : "Open Content Library"}
        </Link>
      </div>
    </div>
  );
}

