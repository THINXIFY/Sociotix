"use client";

import * as React from "react";
import { CalendarPlus, FileText, Folder, ImageIcon, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/i18n";
import type { FolderView } from "@/lib/social/content";
import { SOCIAL_PLATFORMS, type SocialProviderId } from "@/lib/social/platforms";
import type { PostView } from "@/lib/social/publishing";
import { utcToZonedInput } from "@/lib/social/time";
import { cn } from "@/lib/utils";
import { fieldClass, labelClass, MediaThumb } from "./content-parts";
import { primaryButton, quietButton } from "./parts";
import { PlatformStack, postsApi } from "./publishing-parts";

/*
 * Calendar content picker (CM-02): choose one of the customer's saved drafts, see exactly what it contains, and give it a
 * planned date. It plans the existing post (no copy is made) and never schedules or publishes anything.
 */

const headline = (p: PostView) => p.title?.trim() || p.text.trim().split("\n")[0]?.slice(0, 80) || (p.hashtags.length ? `#${p.hashtags[0]}` : "Untitled post");

/** Drafts that can be planned: not archived, not scheduled or published. */
export const plannable = (p: PostView) => !p.archivedAt && (p.status === "draft" || p.status === "cancelled") && p.state !== "published" && p.state !== "partly_published";

/** A sensible starting time: 9:00 on the given day (or tomorrow), in the customer's time zone. */
export function defaultPlanTime(tz: string, day?: string | null) {
  const base = day ? `${day}T09:00` : `${utcToZonedInput(new Date(Date.now() + 86_400_000).toISOString(), tz).slice(0, 10)}T09:00`;
  return base;
}

export function ContentPicker({
  open,
  onOpenChange,
  posts,
  folders,
  tz,
  day,
  onPlanned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  posts: PostView[];
  folders: FolderView[];
  tz: string;
  /** A day (YYYY-MM-DD) to start from, when the picker was opened for a specific day. */
  day?: string | null;
  onPlanned: (message: string) => void;
}) {
  const [q, setQ] = React.useState("");
  const [platform, setPlatform] = React.useState<SocialProviderId | "">("");
  const [folder, setFolder] = React.useState("");
  const [picked, setPicked] = React.useState<string | null>(null);
  const [when, setWhen] = React.useState(() => defaultPlanTime(tz, day));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [now] = React.useState(() => Date.now());

  const candidates = posts.filter(plannable);
  const term = q.trim().toLowerCase();
  const list = candidates
    .filter((p) => (platform ? p.providers.includes(platform) : true))
    .filter((p) => (folder === "none" ? !p.folderId : folder ? p.folderId === folder : true))
    .filter((p) => !term || `${headline(p)} ${p.text} ${p.hashtags.join(" ")}`.toLowerCase().includes(term))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const chosen = candidates.find((p) => p.id === picked) ?? null;
  const folderName = chosen ? folders.find((f) => f.id === chosen.folderId)?.name : undefined;
  const past = !!when && Date.parse(`${when}:00Z`) < now - 14 * 3_600_000;

  async function confirm(e?: React.FormEvent) {
    e?.preventDefault();
    if (!chosen || !when || busy) return;
    setBusy(true);
    setError(null);
    const r = await postsApi(`/api/content/posts/${chosen.id}/flags`, { method: "PATCH", body: JSON.stringify({ plannedLocal: when, timezone: tz }) });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    onPlanned(chosen.plannedAt ? `“${headline(chosen)}” moved on your calendar. Nothing will be posted.` : `“${headline(chosen)}” added to your calendar. Nothing will be posted.`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl" showCloseButton={false}>
        <form onSubmit={confirm} className="flex min-h-0 flex-1 flex-col">
          <div className="border-b px-5 pt-5 pb-4">
            <DialogTitle className="font-heading text-lg font-extrabold">Add from your Content Library</DialogTitle>
            <DialogDescription className="mt-1 text-[0.82rem] text-muted-foreground">
              Pick a saved draft and give it a date. The draft itself isn&apos;t copied or changed, and nothing is posted.
            </DialogDescription>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="relative min-w-0 flex-1 basis-44">
                <span className="sr-only">Search your drafts</span>
                <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drafts" className={cn(fieldClass, "h-11 rounded-full py-0 ps-10 text-sm sm:h-10")} />
              </label>
              <select aria-label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value as SocialProviderId | "")} className={cn(fieldClass, "h-11 w-auto max-w-full min-w-0 rounded-full py-0 ps-3.5 pe-8 text-sm sm:h-10")}>
                <option value="">All platforms</option>
                {SOCIAL_PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select aria-label="Folder" value={folder} onChange={(e) => setFolder(e.target.value)} className={cn(fieldClass, "h-11 w-auto max-w-full min-w-0 rounded-full py-0 ps-3.5 pe-8 text-sm sm:h-10")}>
                <option value="">All folders</option>
                <option value="none">Unfiled</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:overflow-hidden">
            <fieldset className="min-w-0 border-b p-3 md:max-h-[50dvh] md:overflow-y-auto md:border-e md:border-b-0">
              <legend className="sr-only">Drafts</legend>
              {!candidates.length ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  <FileText className="mx-auto mb-2 size-6 text-muted-foreground/70" aria-hidden />
                  You don&apos;t have any drafts to plan yet. Write a post first, then come back.
                </p>
              ) : !list.length ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground" role="status">
                  No drafts match.
                </p>
              ) : (
                <ul className="space-y-1.5" aria-label={`${list.length} ${list.length === 1 ? "draft" : "drafts"}`}>
                  {list.map((p) => (
                    <li key={p.id}>
                      <label className="relative block cursor-pointer">
                        <input
                          type="radio"
                          name="plan-draft"
                          value={p.id}
                          checked={picked === p.id}
                          onChange={() => {
                            setPicked(p.id);
                            setError(null);
                            if (p.plannedAt) setWhen(utcToZonedInput(p.plannedAt, tz));
                          }}
                          className="peer sr-only"
                        />
                        <span className="flex items-start gap-3 rounded-2xl border bg-card p-3 transition-colors peer-checked:border-primary peer-checked:bg-primary/[0.05] peer-focus-visible:ring-3 peer-focus-visible:ring-primary/35 hover:bg-muted/60 dark:peer-checked:bg-primary/15">
                          {p.mediaIds[0] ? (
                            <span className="size-12 shrink-0 overflow-hidden rounded-xl border bg-muted">
                              <MediaThumb id={p.mediaIds[0]} name="" />
                            </span>
                          ) : null}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[0.88rem] font-bold">{headline(p)}</span>
                            <span className="mt-0.5 line-clamp-2 block text-[0.78rem] leading-relaxed text-muted-foreground">{p.text.trim() || "No text yet"}</span>
                            <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.7rem] text-muted-foreground">
                              {p.providers.length ? <PlatformStack providers={p.providers} max={3} /> : null}
                              {p.mediaIds.length ? (
                                <span className="inline-flex items-center gap-1">
                                  <ImageIcon className="size-3" aria-hidden /> {p.mediaIds.length}
                                </span>
                              ) : null}
                              {p.plannedAt ? <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-semibold text-primary dark:text-[#c4b5ff]">Planned {formatDateTime(p.plannedAt)}</span> : <span className="rounded-full bg-muted px-1.5 py-0.5 font-semibold">Draft</span>}
                            </span>
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>

            <div className="min-w-0 p-4 md:max-h-[50dvh] md:overflow-y-auto" aria-live="polite">
              {chosen ? (
                <div className="space-y-3">
                  <div>
                    <p className="font-heading text-[0.95rem] font-bold">{headline(chosen)}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[0.72rem] text-muted-foreground">
                      {chosen.providers.length ? <PlatformStack providers={chosen.providers} /> : <span>No platforms chosen</span>}
                      {folderName ? (
                        <span className="inline-flex items-center gap-1">
                          <Folder className="size-3" aria-hidden /> {folderName}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <p className="max-h-40 overflow-y-auto rounded-2xl bg-muted/50 px-3.5 py-3 text-[0.82rem] leading-relaxed whitespace-pre-wrap dark:bg-white/[0.03]">{chosen.text.trim() || "No text yet."}</p>
                  {chosen.hashtags.length ? <p className="text-[0.78rem] break-words text-primary dark:text-[#c4b5ff]">{chosen.hashtags.map((t) => `#${t}`).join(" ")}</p> : null}
                  {chosen.mediaIds.length ? (
                    <ul className="flex flex-wrap gap-1.5" aria-label="Attached images">
                      {chosen.mediaIds.map((id, i) => (
                        <li key={id} className="size-14 overflow-hidden rounded-xl border bg-muted">
                          <MediaThumb id={id} name={`Image ${i + 1}`} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : (
                <p className="grid h-full min-h-24 place-items-center text-center text-sm text-muted-foreground">Select a draft to preview it here.</p>
              )}
            </div>
          </div>

          <div className="space-y-2 border-t px-5 py-3.5">
            <div className="flex flex-wrap items-end gap-3">
              <label className="block min-w-0 flex-1 basis-52">
                <span className={labelClass}>Planned date and time</span>
                <input type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} className={cn(fieldClass, "mt-1 h-11 py-0 sm:h-10")} />
              </label>
              <div className="flex gap-2">
                <button type="button" className={quietButton} onClick={() => onOpenChange(false)} disabled={busy}>
                  Cancel
                </button>
                <button type="submit" className={primaryButton} disabled={!chosen || !when || busy}>
                  <CalendarPlus className="size-4" aria-hidden /> {busy ? "Saving…" : chosen?.plannedAt ? "Move on calendar" : "Add to calendar"}
                </button>
              </div>
            </div>
            <p className="text-[0.72rem] text-muted-foreground">
              Time zone: {tz}. Planning only places the draft on your calendar.
              {past ? <span className="ms-1 font-semibold text-soon"> That time has already passed.</span> : null}
            </p>
            {error ? (
              <p role="alert" className="rounded-xl bg-destructive/[0.07] px-3 py-2 text-sm font-medium text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
