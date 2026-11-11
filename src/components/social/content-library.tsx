"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu } from "@base-ui/react/menu";
import {
  Archive,
  ArchiveRestore,
  BookmarkPlus,
  CalendarDays,
  Copy,
  FileText,
  Folder,
  FolderInput,
  FolderPlus,
  ImageIcon,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pencil,
  PenLine,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { ConfirmDialog } from "@/components/dashboard/account-ui";
import { Panel, useHydrated } from "@/components/dashboard/shared";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { menuItem, menuItemDestructive, menuPopup, menuSeparator } from "@/components/ui/menu";
import { formatDateTime, useDisplay } from "@/lib/i18n";
import {
  FOLDER_NAME_MAX,
  FOLDERS_MAX,
  formatBytes,
  HASHTAGS_MAX,
  MEDIA_FILES_MAX,
  MEDIA_NAME_MAX,
  MEDIA_TOTAL_BYTES,
  parseHashtags,
  TEMPLATE_NAME_MAX,
  type MediaView,
  type TemplateView,
} from "@/lib/social/content";
import { SOCIAL_PLATFORM, SOCIAL_PLATFORMS, type SocialProviderId } from "@/lib/social/platforms";
import { POST_STATE_LABEL, POST_TEXT_MAX, postHref, PUBLISHING_ROUTES, type PostState, type PostView, type PublishingData } from "@/lib/social/publishing";
import { browserTimeZone, utcToZonedInput } from "@/lib/social/time";
import { cn } from "@/lib/utils";
import { fieldClass, labelClass, MediaThumb, UploadButton, uploadMany } from "./content-parts";
import { page, primaryButton, quietButton, SocialHeader } from "./parts";
import { EmptyIllustration, PlatformStack, postsApi, StateBadge } from "./publishing-parts";

/* Content Library (CM-01): every post the customer has written — organised, searchable and reusable — plus their media library and templates. */

type Section = "content" | "media" | "templates";
type View = "all" | "drafts" | "favorites" | "archived";
type Sort = "updated" | "oldest" | "title" | "planned";
type Layout = "grid" | "list";

const VIEWS: { id: View; label: string }[] = [
  { id: "all", label: "All content" },
  { id: "drafts", label: "Drafts" },
  { id: "favorites", label: "Favorites" },
  { id: "archived", label: "Archived" },
];
const SORTS: { id: Sort; label: string }[] = [
  { id: "updated", label: "Recently updated" },
  { id: "oldest", label: "Oldest first" },
  { id: "title", label: "Title A–Z" },
  { id: "planned", label: "Planned date" },
];
const STATES: PostState[] = ["draft", "planned", "scheduled", "published", "failed", "needs_review"];

const headline = (p: PostView) => p.title?.trim() || p.text.trim().split("\n")[0]?.slice(0, 90) || (p.hashtags.length ? `#${p.hashtags[0]}` : "Untitled post");
const inView = (p: PostView, v: View) => (v === "archived" ? !!p.archivedAt : !p.archivedAt && (v === "all" || (v === "drafts" ? p.state === "draft" || p.state === "planned" : p.favorite)));

const selectClass = cn(fieldClass, "h-11 w-auto max-w-full min-w-0 rounded-full py-0 ps-3.5 pe-8 text-sm sm:h-10");
const iconButton = "grid size-9 place-items-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30";

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export function ContentLibrary({ data }: { data: PublishingData }) {
  useDisplay();
  const [section, setSection] = React.useState<Section>("content");
  const meta = data.content;
  const sections: { id: Section; label: string; n: number }[] = [
    { id: "content", label: "Content", n: data.posts.filter((p) => !p.archivedAt).length },
    { id: "media", label: "Media", n: meta.media.length },
    { id: "templates", label: "Templates", n: meta.templates.length },
  ];
  return (
    <div className={page}>
      <SocialHeader
        title="Content Library"
        subtitle="Write, organise and reuse your social content in one place. Nothing here is published automatically."
        action={
          <Link href={PUBLISHING_ROUTES.compose} className={primaryButton}>
            <Plus className="size-4" aria-hidden /> New post
          </Link>
        }
      />
      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Library sections">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={section === s.id}
            onClick={() => setSection(s.id)}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary/30 sm:h-10",
              section === s.id ? "border-transparent bg-graphite text-white dark:bg-white dark:text-graphite" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {s.label}
            <span className={cn("rounded-full px-1.5 text-[0.7rem] tabular-nums", section === s.id ? "bg-white/20 dark:bg-black/10" : "bg-muted")}>{s.n}</span>
          </button>
        ))}
      </div>
      <div className="mt-5">{section === "content" ? <ContentSection data={data} /> : section === "media" ? <MediaSection media={meta.media} bytes={meta.mediaBytes} /> : <TemplatesSection templates={meta.templates} />}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Content                                                                   */
/* -------------------------------------------------------------------------- */

type Notice = { ok: boolean; text: string } | null;

function ContentSection({ data }: { data: PublishingData }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const folders = data.content.folders;
  const [view, setView] = React.useState<View>("all");
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState<Sort>("updated");
  const [platform, setPlatform] = React.useState<SocialProviderId | "">("");
  const [state, setState] = React.useState<PostState | "">("");
  const [kind, setKind] = React.useState<"" | "text" | "images">("");
  const [folder, setFolder] = React.useState<"all" | "none" | string>("all");
  const [layout, setLayout] = React.useState<Layout>("grid");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [notice, setNotice] = React.useState<Notice>(null);
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<string[] | null>(null);
  const [moving, setMoving] = React.useState<string[] | null>(null);
  const [planning, setPlanning] = React.useState<PostView | null>(null);
  const [folderDialog, setFolderDialog] = React.useState<null | "new" | "rename" | "delete">(null);

  // A post that disappears (deleted, or a view change) can't stay selected.
  const ids = React.useMemo(() => new Set(data.posts.map((p) => p.id)), [data.posts]);
  const chosen = selected.filter((id) => ids.has(id));

  const counts = Object.fromEntries(VIEWS.map((v) => [v.id, data.posts.filter((p) => inView(p, v.id)).length])) as Record<View, number>;
  const term = q.trim().toLowerCase();
  const list = data.posts
    .filter((p) => inView(p, view))
    .filter((p) => (platform ? p.providers.includes(platform) : true))
    .filter((p) => (state ? p.state === state : true))
    .filter((p) => (kind === "images" ? p.mediaIds.length > 0 : kind === "text" ? p.mediaIds.length === 0 : true))
    .filter((p) => (folder === "all" ? true : folder === "none" ? !p.folderId : p.folderId === folder))
    .filter((p) => !term || `${headline(p)} ${p.text} ${p.hashtags.join(" ")} ${p.notes}`.toLowerCase().includes(term))
    .sort((a, b) => {
      if (sort === "oldest") return a.updatedAt.localeCompare(b.updatedAt);
      if (sort === "title") return headline(a).localeCompare(headline(b), undefined, { sensitivity: "base" });
      if (sort === "planned") return (a.plannedAt ?? "9999").localeCompare(b.plannedAt ?? "9999");
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  const filtered = !!(q || platform || state || kind || folder !== "all");
  const clearFilters = () => {
    setQ("");
    setPlatform("");
    setState("");
    setKind("");
    setFolder("all");
  };

  async function run(path: string, method: string, body: unknown, ok: string, after?: () => void) {
    setBusy(true);
    const r = await postsApi<Record<string, unknown>>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
    setBusy(false);
    setNotice(r.ok ? { ok: true, text: ok } : { ok: false, text: r.message });
    if (r.ok) {
      after?.();
      router.refresh();
    }
    return r;
  }

  async function bulk(action: "favorite" | "unfavorite" | "archive" | "restore" | "delete" | "move", targets: string[], folderId?: string | null) {
    setBusy(true);
    const r = await postsApi<{ done: number; skipped: { id: string; reason: string }[] }>("/api/content/bulk", { method: "POST", body: JSON.stringify({ action, ids: targets, ...(action === "move" ? { folderId: folderId ?? null } : {}) }) });
    setBusy(false);
    if (!r.ok) return setNotice({ ok: false, text: r.message });
    const { done, skipped } = r.data;
    const verb = { favorite: "favorited", unfavorite: "removed from favorites", archive: "archived", restore: "restored", delete: "deleted", move: "moved" }[action];
    setNotice({ ok: skipped.length === 0, text: `${done} ${done === 1 ? "post" : "posts"} ${verb}.${skipped.length ? ` ${skipped.length} couldn't change: ${skipped[0]!.reason}` : ""}` });
    setSelected((s) => s.filter((id) => !targets.includes(id) || skipped.some((k) => k.id === id)));
    router.refresh();
  }

  const duplicate = async (p: PostView) => {
    const r = await run(`/api/social/posts/${p.id}/duplicate`, "POST", undefined, "Copy created as a draft.");
    void r;
  };
  const toggleFav = (p: PostView) => void run(`/api/content/posts/${p.id}/flags`, "PATCH", { favorite: !p.favorite }, p.favorite ? "Removed from favorites." : "Added to favorites.");
  const toTemplate = (p: PostView) => void run("/api/content/templates", "POST", { fromPostId: p.id }, "Saved as a template. Find it under Templates.");

  const folderName = folders.find((f) => f.id === folder)?.name;
  const empty = !data.posts.length;

  return (
    <div>
      {notice ? (
        <p role="status" className={cn("mb-4 flex items-start justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-medium", notice.ok ? "bg-ok-soft text-ok" : "bg-destructive/[0.07] text-destructive")}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 rounded-full p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-current" aria-label="Dismiss message">
            <X className="size-4" aria-hidden />
          </button>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Content views">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={view === v.id}
            onClick={() => setView(v.id)}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[0.85rem] font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary/30",
              view === v.id ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-[#c4b5ff]" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {v.id === "favorites" ? <Star className="size-3.5" aria-hidden /> : v.id === "archived" ? <Archive className="size-3.5" aria-hidden /> : null}
            {v.label}
            <span className="tabular-nums opacity-70">{counts[v.id]}</span>
          </button>
        ))}
      </div>

      {!empty ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="relative min-w-0 flex-1 basis-56">
              <span className="sr-only">Search your content</span>
              <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your content" className={cn(fieldClass, "h-11 rounded-full py-0 ps-10 text-sm sm:h-10")} />
            </label>
            <select aria-label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value as SocialProviderId | "")} className={selectClass}>
              <option value="">All platforms</option>
              {SOCIAL_PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select aria-label="Status" value={state} onChange={(e) => setState(e.target.value as PostState | "")} className={selectClass}>
              <option value="">Any status</option>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {POST_STATE_LABEL[s]}
                </option>
              ))}
            </select>
            <select aria-label="Content type" value={kind} onChange={(e) => setKind(e.target.value as "" | "text" | "images")} className={selectClass}>
              <option value="">Any type</option>
              <option value="text">Text only</option>
              <option value="images">With images</option>
            </select>
            <select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={selectClass}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <div className="inline-flex rounded-full border bg-card p-0.5" role="group" aria-label="Layout">
              {(["grid", "list"] as const).map((l) => (
                <button key={l} type="button" aria-pressed={layout === l} aria-label={l === "grid" ? "Grid layout" : "List layout"} onClick={() => setLayout(l)} className={cn("grid size-10 place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-primary/30 sm:size-9", layout === l ? "bg-graphite text-white dark:bg-white dark:text-graphite" : "text-muted-foreground hover:text-foreground")}>
                  {l === "grid" ? <LayoutGrid className="size-4" aria-hidden /> : <List className="size-4" aria-hidden />}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Folders">
            <FolderChip active={folder === "all"} onClick={() => setFolder("all")} label="All folders" />
            <FolderChip active={folder === "none"} onClick={() => setFolder("none")} label="Unfiled" />
            {folders.map((f) => (
              <FolderChip key={f.id} active={folder === f.id} onClick={() => setFolder(f.id)} label={f.name} count={f.count} icon />
            ))}
            <button type="button" onClick={() => setFolderDialog("new")} disabled={folders.length >= FOLDERS_MAX} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed px-3 text-[0.8rem] font-semibold text-muted-foreground transition-colors outline-none hover:border-primary/40 hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/30 disabled:opacity-50">
              <FolderPlus className="size-3.5" aria-hidden /> New folder
            </button>
            {folderName ? (
              <span className="ms-auto inline-flex gap-1">
                <button type="button" className={cn(quietButton, "h-9 px-3 text-[0.8rem] sm:h-9")} onClick={() => setFolderDialog("rename")}>
                  <Pencil className="size-3.5" aria-hidden /> Rename folder
                </button>
                <button type="button" className={cn(quietButton, "h-9 px-3 text-[0.8rem] sm:h-9")} onClick={() => setFolderDialog("delete")}>
                  <Trash2 className="size-3.5" aria-hidden /> Delete folder
                </button>
              </span>
            ) : null}
          </div>
        </>
      ) : null}

      <p className="mt-4 text-[0.8rem] text-muted-foreground" aria-live="polite">
        {empty ? "" : filtered || view !== "all" ? `${list.length} ${list.length === 1 ? "post" : "posts"} shown` : `${list.length} ${list.length === 1 ? "post" : "posts"}`}
        {filtered ? (
          <>
            {" · "}
            <button type="button" onClick={clearFilters} className="font-semibold text-primary outline-none hover:underline focus-visible:underline">
              Clear filters
            </button>
          </>
        ) : null}
      </p>

      {empty ? (
        <EmptyContent />
      ) : !list.length ? (
        <Panel className="mt-3 p-8 text-center">
          <EmptyIllustration icon={Search} />
          <p className="mt-3 font-heading text-lg font-bold">{view === "archived" ? "Nothing archived" : view === "favorites" ? "No favorites yet" : filtered ? "No content matches" : "Nothing here yet"}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {view === "archived" ? "Posts you archive are kept here, out of your way, until you restore them." : view === "favorites" ? "Star a post to keep it handy here." : filtered ? "Try a different search or clear the filters." : "Write a post and it will appear here."}
          </p>
          {filtered ? (
            <button type="button" className={cn(quietButton, "mt-4")} onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
        </Panel>
      ) : (
        <ul className={cn("mt-3 gap-3", layout === "grid" ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col")}>
          {list.map((p) => (
            <li key={p.id}>
              <Item
                post={p}
                layout={layout}
                hydrated={hydrated}
                checked={chosen.includes(p.id)}
                onCheck={(on) => setSelected((s) => (on ? [...s, p.id] : s.filter((x) => x !== p.id)))}
                folderName={folders.find((f) => f.id === p.folderId)?.name}
                busy={busy}
                actions={{
                  favorite: () => toggleFav(p),
                  duplicate: () => void duplicate(p),
                  template: () => toTemplate(p),
                  plan: () => setPlanning(p),
                  move: () => setMoving([p.id]),
                  archive: () => void bulk(p.archivedAt ? "restore" : "archive", [p.id]),
                  remove: () => setConfirmDelete([p.id]),
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {chosen.length ? (
        <div className="sticky bottom-20 z-30 mt-5 flex flex-wrap items-center gap-2 rounded-3xl border bg-card/95 px-4 py-3 shadow-float backdrop-blur-xl lg:bottom-4" role="region" aria-label="Selected posts">
          <p className="me-auto text-sm font-semibold" aria-live="polite">
            {chosen.length} selected
          </p>
          <button type="button" className={cn(quietButton, "h-10 sm:h-9")} disabled={busy} onClick={() => void bulk("favorite", chosen)}>
            <Star className="size-4" aria-hidden /> Favorite
          </button>
          <button type="button" className={cn(quietButton, "h-10 sm:h-9")} disabled={busy} onClick={() => setMoving(chosen)}>
            <FolderInput className="size-4" aria-hidden /> Move
          </button>
          <button type="button" className={cn(quietButton, "h-10 sm:h-9")} disabled={busy} onClick={() => void bulk(view === "archived" ? "restore" : "archive", chosen)}>
            {view === "archived" ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />} {view === "archived" ? "Restore" : "Archive"}
          </button>
          <button type="button" className={cn(quietButton, "h-10 text-destructive sm:h-9")} disabled={busy} onClick={() => setConfirmDelete(chosen)}>
            <Trash2 className="size-4" aria-hidden /> Delete
          </button>
          <button type="button" className={cn(quietButton, "h-10 sm:h-9")} onClick={() => setSelected([])}>
            Clear
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        tone="danger"
        title={confirmDelete && confirmDelete.length > 1 ? `Delete ${confirmDelete.length} posts?` : "Delete this post?"}
        description="This can't be undone. Posts that are scheduled or already reached a platform are kept, and you'll be told which."
        confirmLabel="Delete"
        onConfirm={() => {
          const t = confirmDelete ?? [];
          setConfirmDelete(null);
          void bulk("delete", t);
        }}
      />

      <MoveDialog
        key={moving?.join(",") ?? "none"}
        targets={moving}
        folders={folders}
        onClose={() => setMoving(null)}
        onMove={(folderId) => {
          const t = moving ?? [];
          setMoving(null);
          void bulk("move", t, folderId);
        }}
      />
      <PlanDialog key={planning?.id ?? "none"} post={planning} onClose={() => setPlanning(null)} onSave={(local, tz) => void run(`/api/content/posts/${planning!.id}/flags`, "PATCH", { plannedLocal: local, ...(local ? { timezone: tz } : {}) }, local ? "Planned on your calendar. Nothing will be posted." : "Removed from your calendar.", () => setPlanning(null))} />
      <FolderDialog
        key={`${folderDialog ?? "none"}-${folder}`}
        mode={folderDialog}
        current={folders.find((f) => f.id === folder)}
        onClose={() => setFolderDialog(null)}
        onDone={(text, nextFolder) => {
          setFolderDialog(null);
          if (nextFolder !== undefined) setFolder(nextFolder);
          setNotice({ ok: true, text });
          router.refresh();
        }}
        onError={(text) => setNotice({ ok: false, text })}
      />
    </div>
  );
}

function FolderChip({ active, onClick, label, count, icon }: { active: boolean; onClick: () => void; label: string; count?: number; icon?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 max-w-[14rem] items-center gap-1.5 rounded-full border px-3 text-[0.8rem] font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary/30",
        active ? "border-primary/30 bg-primary/10 text-primary dark:bg-primary/20 dark:text-[#c4b5ff]" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {icon ? <Folder className="size-3.5 shrink-0" aria-hidden /> : null}
      <span className="truncate">{label}</span>
      {count !== undefined ? <span className="tabular-nums opacity-70">{count}</span> : null}
    </button>
  );
}

function EmptyContent() {
  const steps = [
    { icon: PenLine, title: "Write a post", body: "Draft once, adjust it for each platform, add hashtags and images, and it saves as you go." },
    { icon: BookmarkPlus, title: "Save what works", body: "Turn any draft into a template, so the next one starts from your best caption." },
    { icon: CalendarDays, title: "Plan it", body: "Give drafts a planned date to see them on your calendar. Nothing is posted automatically." },
  ];
  return (
    <Panel className="mt-3 p-6 sm:p-8">
      <div className="text-center">
        <EmptyIllustration icon={FileText} />
        <h2 className="mt-3 font-heading text-xl font-extrabold">Your content library is empty</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Everything you write is kept here, organised in folders and ready to reuse.</p>
        <Link href={PUBLISHING_ROUTES.compose} className={cn(primaryButton, "mt-4")}>
          <Plus className="size-4" aria-hidden /> Write your first post
        </Link>
      </div>
      <ul className="mt-7 grid gap-3 sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.title} className="rounded-2xl bg-muted/50 p-4 dark:bg-white/[0.03]">
            <s.icon className="size-5 text-primary" aria-hidden />
            <p className="mt-2 text-sm font-semibold">{s.title}</p>
            <p className="mt-0.5 text-[0.8rem] leading-relaxed text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

interface ItemActions {
  favorite: () => void;
  duplicate: () => void;
  template: () => void;
  plan: () => void;
  move: () => void;
  archive: () => void;
  remove: () => void;
}

function Item({ post: p, layout, hydrated, checked, onCheck, folderName, busy, actions }: { post: PostView; layout: Layout; hydrated: boolean; checked: boolean; onCheck: (on: boolean) => void; folderName?: string; busy: boolean; actions: ItemActions }) {
  const locked = p.status === "scheduled";
  const title = headline(p);
  const thumb = p.mediaIds[0];
  return (
    <article className={cn("group relative flex gap-3 rounded-3xl border bg-card p-4 shadow-soft transition-shadow hover:shadow-float", layout === "grid" ? "h-full flex-col" : "items-start", checked && "ring-2 ring-primary/50", p.archivedAt && "opacity-80")}>
      <div className={cn("flex items-start gap-3", layout === "list" && "min-w-0 flex-1")}>
        <label className="mt-0.5 grid size-6 shrink-0 cursor-pointer place-items-center">
          <input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} disabled={!hydrated} className="size-4 accent-[#7047EB]" aria-label={`Select ${title}`} />
        </label>
        {thumb ? (
          <div className="size-14 shrink-0 overflow-hidden rounded-xl border bg-muted">
            <MediaThumb id={thumb} name="" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <Link href={postHref(p.id)} className="block truncate rounded text-[0.95rem] font-bold outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40">
            {title}
          </Link>
          <p className="mt-0.5 line-clamp-2 text-[0.82rem] leading-relaxed text-muted-foreground">{p.text.trim() || "No text yet"}</p>
        </div>
      </div>
      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", layout === "grid" ? "mt-auto" : "shrink-0 justify-end")}>
        <StateBadge state={p.state} />
        {p.archivedAt ? <span className="rounded-full bg-muted px-2 py-0.5 text-[0.68rem] font-semibold text-muted-foreground">Archived</span> : null}
        {p.providers.length ? <PlatformStack providers={p.providers} /> : null}
        {p.mediaIds.length ? (
          <span className="inline-flex items-center gap-1 text-[0.72rem] text-muted-foreground">
            <ImageIcon className="size-3.5" aria-hidden /> {p.mediaIds.length}
          </span>
        ) : null}
        {folderName ? (
          <span className="inline-flex max-w-32 items-center gap-1 truncate text-[0.72rem] text-muted-foreground">
            <Folder className="size-3.5 shrink-0" aria-hidden /> <span className="truncate">{folderName}</span>
          </span>
        ) : null}
        <span className="text-[0.72rem] text-muted-foreground">{p.plannedAt && p.state === "planned" ? `Planned ${formatDateTime(p.plannedAt)}` : `Updated ${formatDateTime(p.updatedAt)}`}</span>
        <span className="ms-auto inline-flex items-center">
          <button type="button" onClick={actions.favorite} disabled={busy} aria-pressed={p.favorite} aria-label={p.favorite ? `Remove ${title} from favorites` : `Add ${title} to favorites`} className={cn(iconButton, p.favorite && "text-amber-500 hover:text-amber-500")}>
            <Star className={cn("size-4", p.favorite && "fill-current")} aria-hidden />
          </button>
          <Menu.Root>
            <Menu.Trigger aria-label={`More actions for ${title}`} className={iconButton}>
              <MoreHorizontal className="size-4" aria-hidden />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner sideOffset={6} align="end" className="z-50 outline-none">
                <Menu.Popup className={cn(menuPopup, "min-w-52")}>
                  <Menu.Item render={<Link href={postHref(p.id)} />} className={menuItem}>
                    <Pencil className="size-4" aria-hidden /> {locked ? "Open" : "Edit"}
                  </Menu.Item>
                  <Menu.Item className={menuItem} onClick={actions.duplicate}>
                    <Copy className="size-4" aria-hidden /> Duplicate
                  </Menu.Item>
                  <Menu.Item className={menuItem} onClick={actions.template}>
                    <BookmarkPlus className="size-4" aria-hidden /> Save as template
                  </Menu.Item>
                  <Menu.Item className={menuItem} onClick={actions.move}>
                    <FolderInput className="size-4" aria-hidden /> Move to folder…
                  </Menu.Item>
                  {!locked ? (
                    <Menu.Item className={menuItem} onClick={actions.plan}>
                      <CalendarDays className="size-4" aria-hidden /> {p.plannedAt ? "Change planned date…" : "Plan on calendar…"}
                    </Menu.Item>
                  ) : null}
                  <div className={menuSeparator} role="separator" />
                  {!locked ? (
                    <Menu.Item className={menuItem} onClick={actions.archive}>
                      {p.archivedAt ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />} {p.archivedAt ? "Restore" : "Archive"}
                    </Menu.Item>
                  ) : null}
                  <Menu.Item className={cn(menuItem, menuItemDestructive)} onClick={actions.remove}>
                    <Trash2 className="size-4" aria-hidden /> Delete
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </span>
      </div>
      {p.hashtags.length && layout === "grid" ? <p className="truncate text-[0.74rem] text-primary dark:text-[#c4b5ff]">{p.hashtags.slice(0, 4).map((t) => `#${t}`).join(" ")}</p> : null}
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dialogs                                                                   */
/* -------------------------------------------------------------------------- */

function DialogFrame({ open, onClose, title, description, children, footer }: { open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88dvh] gap-0 overflow-hidden p-0 sm:max-w-md" showCloseButton={false}>
        <div className="border-b px-5 pt-5 pb-4">
          <DialogTitle className="font-heading text-lg font-extrabold">{title}</DialogTitle>
          {description ? <DialogDescription className="mt-1 text-[0.82rem] text-muted-foreground">{description}</DialogDescription> : null}
        </div>
        <div className="max-h-[56dvh] overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-3.5">{footer}</div>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({ targets, folders, onClose, onMove }: { targets: string[] | null; folders: PublishingData["content"]["folders"]; onClose: () => void; onMove: (folderId: string | null) => void }) {
  const [value, setValue] = React.useState("");
  return (
    <DialogFrame
      open={!!targets}
      onClose={onClose}
      title={targets && targets.length > 1 ? `Move ${targets.length} posts` : "Move to folder"}
      footer={
        <>
          <button type="button" className={quietButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryButton} onClick={() => onMove(value || null)}>
            Move
          </button>
        </>
      }
    >
      <label className="block">
        <span className={labelClass}>Folder</span>
        <select value={value} onChange={(e) => setValue(e.target.value)} className={cn(fieldClass, "mt-1.5")}>
          <option value="">No folder (unfiled)</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      {!folders.length ? <p className="mt-2 text-[0.78rem] text-muted-foreground">You don&apos;t have any folders yet. Create one with “New folder”.</p> : null}
    </DialogFrame>
  );
}

function PlanDialog({ post, onClose, onSave }: { post: PostView | null; onClose: () => void; onSave: (local: string | null, tz: string) => void }) {
  const [value, setValue] = React.useState(post?.plannedAt ? utcToZonedInput(post.plannedAt, post.timezone) : "");
  const tz = post?.timezone && post.timezone !== "UTC" ? post.timezone : browserTimeZone();
  return (
    <DialogFrame
      open={!!post}
      onClose={onClose}
      title="Plan on your calendar"
      description="This only places the draft on your calendar. Nothing is posted."
      footer={
        <>
          {post?.plannedAt ? (
            <button type="button" className={cn(quietButton, "me-auto")} onClick={() => onSave(null, tz)}>
              Remove date
            </button>
          ) : null}
          <button type="button" className={quietButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryButton} disabled={!value} onClick={() => onSave(value, tz)}>
            Save date
          </button>
        </>
      }
    >
      <label className="block">
        <span className={labelClass}>Planned date and time</span>
        <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} className={cn(fieldClass, "mt-1.5")} />
      </label>
      <p className="mt-1.5 text-[0.72rem] text-muted-foreground">Time zone: {tz}</p>
      <Link href="/dashboard/social/calendar" className="mt-3 inline-block text-[0.8rem] font-semibold text-primary hover:underline">
        Open the calendar
      </Link>
    </DialogFrame>
  );
}

function FolderDialog({ mode, current, onClose, onDone, onError }: { mode: null | "new" | "rename" | "delete"; current?: { id: string; name: string; count: number }; onClose: () => void; onDone: (text: string, nextFolder?: string) => void; onError: (text: string) => void }) {
  const [name, setName] = React.useState(mode === "rename" ? (current?.name ?? "") : "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!mode) return;
    setBusy(true);
    setError(null);
    if (mode === "delete") {
      const r = await postsApi(`/api/content/folders/${current!.id}`, { method: "DELETE" });
      setBusy(false);
      if (!r.ok) return onError(r.message);
      return onDone("Folder deleted. Its posts are still in your library.", "all");
    }
    const r = await postsApi<{ folder: { id: string } }>(mode === "new" ? "/api/content/folders" : `/api/content/folders/${current!.id}`, { method: mode === "new" ? "POST" : "PATCH", body: JSON.stringify({ name }) });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    onDone(mode === "new" ? `Folder “${name.trim()}” created.` : "Folder renamed.", mode === "new" ? r.data.folder.id : undefined);
  }

  return (
    <DialogFrame
      open={!!mode}
      onClose={onClose}
      title={mode === "new" ? "New folder" : mode === "rename" ? "Rename folder" : "Delete this folder?"}
      description={mode === "delete" ? `“${current?.name}” will be removed. The ${current?.count ?? 0} ${current?.count === 1 ? "post" : "posts"} inside are not deleted; they become unfiled.` : undefined}
      footer={
        <>
          <button type="button" className={quietButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={cn(primaryButton, mode === "delete" && "bg-destructive hover:bg-destructive/90")} disabled={busy || (mode !== "delete" && !name.trim())} onClick={() => void submit()}>
            {busy ? "Working…" : mode === "new" ? "Create folder" : mode === "rename" ? "Save name" : "Delete folder"}
          </button>
        </>
      }
    >
      {mode !== "delete" ? (
        <form onSubmit={submit}>
          <label className="block">
            <span className={labelClass}>Folder name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={FOLDER_NAME_MAX} autoFocus className={cn(fieldClass, "mt-1.5")} placeholder="e.g. Summer campaign" aria-invalid={error ? true : undefined} aria-describedby={error ? "folder-error" : undefined} />
          </label>
          {error ? (
            <p id="folder-error" role="alert" className="mt-2 text-[0.8rem] font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </DialogFrame>
  );
}

/* -------------------------------------------------------------------------- */
/*  Media                                                                     */
/* -------------------------------------------------------------------------- */

function MediaSection({ media, bytes }: { media: MediaView[]; bytes: number }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [problems, setProblems] = React.useState<string[]>([]);
  const [notice, setNotice] = React.useState<Notice>(null);
  const [dragging, setDragging] = React.useState(false);
  const [preview, setPreview] = React.useState<MediaView | null>(null);
  const [renaming, setRenaming] = React.useState<MediaView | null>(null);
  const [removing, setRemoving] = React.useState<MediaView | null>(null);
  const term = q.trim().toLowerCase();
  const list = media.filter((m) => !term || m.name.toLowerCase().includes(term));

  async function upload(files: File[]) {
    setBusy(true);
    setProblems([]);
    setNotice(null);
    let added = 0;
    const out = await uploadMany(files, () => added++);
    setProblems(out);
    if (added) setNotice({ ok: true, text: `${added} ${added === 1 ? "image" : "images"} added to your library.` });
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-56">
          <span className="sr-only">Search your media</span>
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search images by name" className={cn(fieldClass, "h-11 rounded-full py-0 ps-10 text-sm sm:h-10")} />
        </label>
        <UploadButton onFiles={(f) => void upload(f)} busy={busy} />
      </div>
      <p className="mt-2 text-[0.78rem] text-muted-foreground">
        {media.length} of {MEDIA_FILES_MAX} images · {formatBytes(bytes)} of {formatBytes(MEDIA_TOTAL_BYTES)} used · JPEG, PNG or WebP up to 5 MB each. Only you can see your library.
      </p>
      {notice ? (
        <p role="status" className={cn("mt-3 rounded-2xl px-4 py-3 text-sm font-medium", notice.ok ? "bg-ok-soft text-ok" : "bg-destructive/[0.07] text-destructive")}>
          {notice.text}
        </p>
      ) : null}
      {problems.length ? (
        <ul role="alert" className="mt-3 space-y-1 rounded-2xl bg-destructive/[0.07] px-4 py-3 text-[0.82rem] font-medium text-destructive">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const files = [...e.dataTransfer.files];
          if (files.length) void upload(files);
        }}
        className={cn("mt-4 rounded-3xl transition-colors", dragging && "bg-primary/[0.06] ring-2 ring-primary/40")}
      >
        {!media.length ? (
          <Panel className="p-8 text-center">
            <EmptyIllustration icon={ImageIcon} />
            <h2 className="mt-3 font-heading text-xl font-extrabold">Your media library is empty</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Upload images once and reuse them across as many drafts as you like. You can also drop files here.</p>
          </Panel>
        ) : !list.length ? (
          <Panel className="p-8 text-center text-sm text-muted-foreground">No images match “{q}”.</Panel>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {list.map((m) => (
              <li key={m.id} className="overflow-hidden rounded-3xl border bg-card shadow-soft">
                <button type="button" onClick={() => setPreview(m)} className="block aspect-square w-full overflow-hidden bg-muted outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-primary/40" aria-label={`Preview ${m.name}`}>
                  <MediaThumb id={m.id} name={m.name} />
                </button>
                <div className="flex items-start gap-1 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.85rem] font-semibold" title={m.name}>
                      {m.name}
                    </p>
                    <p className="text-[0.7rem] text-muted-foreground">
                      {m.width}×{m.height} · {formatBytes(m.sizeBytes)}
                      {m.usedBy ? ` · used in ${m.usedBy} ${m.usedBy === 1 ? "post" : "posts"}` : ""}
                    </p>
                  </div>
                  <button type="button" className={iconButton} onClick={() => setRenaming(m)} aria-label={`Rename ${m.name}`}>
                    <Pencil className="size-4" aria-hidden />
                  </button>
                  <button type="button" className={iconButton} onClick={() => setRemoving(m)} aria-label={`Delete ${m.name}`}>
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[92dvh] gap-0 overflow-hidden p-0 sm:max-w-3xl" showCloseButton={false}>
          <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
            <DialogTitle className="min-w-0 truncate font-heading text-base font-extrabold">{preview?.name}</DialogTitle>
            <button type="button" className={iconButton} onClick={() => setPreview(null)} aria-label="Close preview">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <DialogDescription className="sr-only">Preview of an image in your media library.</DialogDescription>
          <div className="grid max-h-[74dvh] place-items-center overflow-auto bg-muted/50 p-3">{preview ? <MediaThumb id={preview.id} name={preview.name} className="max-h-[70dvh] w-auto max-w-full rounded-xl object-contain" /> : null}</div>
          {preview ? (
            <p className="border-t px-5 py-3 text-[0.78rem] text-muted-foreground">
              {preview.width}×{preview.height} · {formatBytes(preview.sizeBytes)} · added {formatDateTime(preview.createdAt)}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>

      <RenameMedia key={renaming?.id ?? "none"} media={renaming} onClose={() => setRenaming(null)} onDone={(text) => { setRenaming(null); setNotice({ ok: true, text }); router.refresh(); }} />

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        tone="danger"
        title="Delete this image?"
        description={removing?.usedBy ? `“${removing.name}” is used in ${removing.usedBy} ${removing.usedBy === 1 ? "post" : "posts"}. It will be removed from ${removing.usedBy === 1 ? "it" : "them"}, and the posts keep their text.` : `“${removing?.name}” will be removed from your library.`}
        confirmLabel="Delete image"
        onConfirm={async () => {
          const m = removing!;
          setRemoving(null);
          const r = await postsApi(`/api/content/media/${m.id}`, { method: "DELETE" });
          setNotice(r.ok ? { ok: true, text: "Image deleted." } : { ok: false, text: r.message });
          router.refresh();
        }}
      />
    </div>
  );
}

function RenameMedia({ media, onClose, onDone }: { media: MediaView | null; onClose: () => void; onDone: (text: string) => void }) {
  const [name, setName] = React.useState(media?.name ?? "");
  const [error, setError] = React.useState<string | null>(null);
  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    const r = await postsApi(`/api/content/media/${media!.id}`, { method: "PATCH", body: JSON.stringify({ name }) });
    if (r.ok) onDone("Image renamed.");
    else setError(r.message);
  }
  return (
    <DialogFrame
      open={!!media}
      onClose={onClose}
      title="Rename image"
      footer={
        <>
          <button type="button" className={quietButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryButton} disabled={!name.trim()} onClick={() => void save()}>
            Save name
          </button>
        </>
      }
    >
      <form onSubmit={save}>
        <label className="block">
          <span className={labelClass}>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={MEDIA_NAME_MAX} autoFocus className={cn(fieldClass, "mt-1.5")} />
        </label>
        {error ? (
          <p role="alert" className="mt-2 text-[0.8rem] font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </form>
    </DialogFrame>
  );
}

/* -------------------------------------------------------------------------- */
/*  Templates                                                                 */
/* -------------------------------------------------------------------------- */

function TemplatesSection({ templates }: { templates: TemplateView[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<TemplateView | "new" | null>(null);
  const [removing, setRemoving] = React.useState<TemplateView | null>(null);
  const [notice, setNotice] = React.useState<Notice>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  async function use(t: TemplateView) {
    setBusy(t.id);
    const r = await postsApi<{ post: PostView }>(`/api/content/templates/${t.id}/use`, { method: "POST", body: JSON.stringify({ timezone: browserTimeZone() }) });
    setBusy(null);
    if (r.ok) router.push(postHref(r.data.post.id));
    else setNotice({ ok: false, text: r.message });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">Templates are reusable captions. Using one copies it into a new draft, so changing the draft never changes the template.</p>
        <button type="button" className={primaryButton} onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden /> New template
        </button>
      </div>
      {notice ? (
        <p role="status" className={cn("mt-3 rounded-2xl px-4 py-3 text-sm font-medium", notice.ok ? "bg-ok-soft text-ok" : "bg-destructive/[0.07] text-destructive")}>
          {notice.text}
        </p>
      ) : null}
      {!templates.length ? (
        <Panel className="mt-4 p-8 text-center">
          <EmptyIllustration icon={BookmarkPlus} />
          <h2 className="mt-3 font-heading text-xl font-extrabold">No templates yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Create one here, or open any draft and choose “Save as template” to keep a caption that works.</p>
        </Panel>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <li key={t.id} className="flex flex-col rounded-3xl border bg-card p-4 shadow-soft">
              <p className="truncate text-[0.95rem] font-bold">{t.name}</p>
              <p className="mt-1 line-clamp-3 text-[0.82rem] leading-relaxed whitespace-pre-line text-muted-foreground">{t.body || "No text"}</p>
              {t.hashtags.length ? <p className="mt-2 truncate text-[0.74rem] text-primary dark:text-[#c4b5ff]">{t.hashtags.map((x) => `#${x}`).join(" ")}</p> : null}
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                {t.providers.length ? <PlatformStack providers={t.providers} /> : null}
                <span className="ms-auto inline-flex items-center gap-1">
                  <button type="button" className={cn(quietButton, "h-9 px-3 text-[0.8rem] sm:h-9")} disabled={busy === t.id} onClick={() => void use(t)}>
                    <Copy className="size-3.5" aria-hidden /> {busy === t.id ? "Creating…" : "Use"}
                  </button>
                  <button type="button" className={iconButton} onClick={() => setEditing(t)} aria-label={`Edit ${t.name}`}>
                    <Pencil className="size-4" aria-hidden />
                  </button>
                  <button type="button" className={iconButton} onClick={() => setRemoving(t)} aria-label={`Delete ${t.name}`}>
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <TemplateDialog
        key={editing === "new" ? "new" : (editing?.id ?? "none")}
        template={editing}
        onClose={() => setEditing(null)}
        onDone={(text) => {
          setEditing(null);
          setNotice({ ok: true, text });
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        tone="danger"
        title="Delete this template?"
        description={`“${removing?.name}” will be removed. Drafts you already made from it are not affected.`}
        confirmLabel="Delete template"
        onConfirm={async () => {
          const t = removing!;
          setRemoving(null);
          const r = await postsApi(`/api/content/templates/${t.id}`, { method: "DELETE" });
          setNotice(r.ok ? { ok: true, text: "Template deleted." } : { ok: false, text: r.message });
          router.refresh();
        }}
      />
    </div>
  );
}

function TemplateDialog({ template, onClose, onDone }: { template: TemplateView | "new" | null; onClose: () => void; onDone: (text: string) => void }) {
  const isNew = template === "new";
  const t = template && template !== "new" ? template : null;
  const [name, setName] = React.useState(t?.name ?? "");
  const [text, setText] = React.useState(t?.body ?? "");
  const [tags, setTags] = React.useState((t?.hashtags ?? []).map((x) => `#${x}`).join(" "));
  const [providers, setProviders] = React.useState<SocialProviderId[]>(t?.providers ?? []);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const parsed = parseHashtags(tags);

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const body = JSON.stringify({ name, text, hashtags: parsed.tags, providers });
    const r = await postsApi(isNew ? "/api/content/templates" : `/api/content/templates/${t!.id}`, { method: isNew ? "POST" : "PATCH", body });
    setBusy(false);
    if (r.ok) onDone(isNew ? "Template created." : "Template saved.");
    else setError(r.message);
  }

  return (
    <DialogFrame
      open={!!template}
      onClose={onClose}
      title={isNew ? "New template" : "Edit template"}
      footer={
        <>
          <button type="button" className={quietButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryButton} disabled={busy || !name.trim() || parsed.tags.length > HASHTAGS_MAX} onClick={() => void save()}>
            {busy ? "Saving…" : isNew ? "Create template" : "Save template"}
          </button>
        </>
      }
    >
      <form onSubmit={save} className="space-y-4">
        <label className="block">
          <span className={labelClass}>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={TEMPLATE_NAME_MAX} autoFocus className={cn(fieldClass, "mt-1.5")} placeholder="e.g. Product launch" />
        </label>
        <label className="block">
          <span className={labelClass}>Caption</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={POST_TEXT_MAX} className={cn(fieldClass, "mt-1.5 resize-y leading-relaxed")} placeholder="The words you want to start from" />
        </label>
        <label className="block">
          <span className={labelClass}>
            Hashtags <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} className={cn(fieldClass, "mt-1.5")} placeholder="#launch #new" autoCapitalize="none" spellCheck={false} />
          {parsed.invalid.length ? <span className="mt-1 block text-[0.72rem] font-semibold text-destructive">Left out: {parsed.invalid.slice(0, 3).join(", ")}</span> : null}
        </label>
        <div>
          <p className={labelClass}>
            Platforms <span className="font-normal text-muted-foreground">(optional)</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Platforms">
            {SOCIAL_PLATFORMS.map((p) => {
              const on = providers.includes(p.id);
              return (
                <button key={p.id} type="button" aria-pressed={on} onClick={() => setProviders(on ? providers.filter((x) => x !== p.id) : [...providers, p.id])} className={cn("h-9 rounded-full border px-3 text-[0.78rem] font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary/30", on ? "border-primary/30 bg-primary/10 text-primary dark:bg-primary/20 dark:text-[#c4b5ff]" : "text-muted-foreground hover:bg-muted")}>
                  {SOCIAL_PLATFORM[p.id].name}
                </button>
              );
            })}
          </div>
        </div>
        {error ? (
          <p role="alert" className="text-[0.8rem] font-medium text-destructive">
            {error}
          </p>
        ) : null}
        <button type="submit" className="sr-only" tabIndex={-1}>
          Save
        </button>
      </form>
    </DialogFrame>
  );
}
