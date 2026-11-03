"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Eye, MoreHorizontal, Newspaper, PencilLine, Plus, RotateCcw, Search, Send, Star, Tags, Trash2, Undo2 } from "lucide-react";
import { Menu } from "@base-ui/react/menu";
import { Pagination } from "@/components/dashboard/shared";
import { menuItem, menuItemDestructive, menuPopup } from "@/components/ui/menu";
import { type AdminPostList, type AdminPostRow, type PostState } from "@/lib/blog/admin";
import { formatDate, formatDateTime } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SelectInput } from "../form";
import { Card } from "../ui";
import { CategoryManager, useCategories } from "./categories";
import { blogApi, ConfirmDialog, PostStatus } from "./shared";

/* Admin → Blog Management: every admin-written post with search, filters, paging and row actions. */

const PAGE_SIZE = 15;
const TABS: { id: PostState | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts" },
  { id: "scheduled", label: "Scheduled" },
  { id: "published", label: "Published" },
];

type Pending = { kind: "delete" | "unpublish" | "publish"; post: AdminPostRow } | null;

function Thumb({ post }: { post: AdminPostRow }) {
  return (
    <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary text-primary" aria-hidden>
      {post.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- uploaded image thumbnail
        <img src={post.image.src} alt="" width={48} height={48} className="size-full object-cover" loading="lazy" />
      ) : (
        <Newspaper className="size-5" />
      )}
    </span>
  );
}

function when(p: AdminPostRow) {
  if (p.state === "scheduled" && p.publishedAt) return `Goes live ${formatDateTime(p.publishedAt, { year: true })}`;
  if (p.state === "published" && p.publishedAt) return `Published ${formatDate(p.publishedAt, { year: true })}`;
  return `Edited ${formatDate(p.updatedAt, { year: true })}`;
}

function RowActions({ post, canManage, onAct }: { post: AdminPostRow; canManage: boolean; onAct: (p: Pending) => void }) {
  return (
    <Menu.Root>
      <Menu.Trigger aria-label={`Actions for ${post.title}`} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none">
        <MoreHorizontal className="size-4" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-50 outline-none">
          <Menu.Popup className={cn(menuPopup, "min-w-48")}>
            {canManage ? (
              <Menu.Item render={<Link href={`/admin/blog/${post.id}/edit`} />} className={menuItem}>
                <PencilLine className="size-4" aria-hidden /> Edit
              </Menu.Item>
            ) : null}
            <Menu.Item render={<Link href={`/admin/blog/${post.id}/preview`} />} className={menuItem}>
              <Eye className="size-4" aria-hidden /> Preview
            </Menu.Item>
            {post.state === "published" ? (
              <Menu.Item render={<a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer" />} className={menuItem}>
                <ExternalLink className="size-4" aria-hidden /> View on blog
              </Menu.Item>
            ) : null}
            {canManage ? (
              <>
                {post.state === "draft" ? (
                  <Menu.Item onClick={() => onAct({ kind: "publish", post })} className={menuItem}>
                    <Send className="size-4" aria-hidden /> Publish now
                  </Menu.Item>
                ) : (
                  <Menu.Item onClick={() => onAct({ kind: "unpublish", post })} className={menuItem}>
                    <Undo2 className="size-4" aria-hidden /> {post.state === "scheduled" ? "Cancel schedule" : "Unpublish"}
                  </Menu.Item>
                )}
                <Menu.Item onClick={() => onAct({ kind: "delete", post })} className={cn(menuItem, menuItemDestructive)}>
                  <Trash2 className="size-4" aria-hidden /> Delete
                </Menu.Item>
              </>
            ) : null}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function BlogPosts({ canManage }: { canManage: boolean }) {
  const [q, setQ] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [managing, setManaging] = React.useState(false);
  const cats = useCategories();
  const [status, setStatus] = React.useState<PostState | "all">("all");
  const [page, setPage] = React.useState(1);
  const [reload, setReload] = React.useState(0);
  const [state, setState] = React.useState<{ key?: string; data?: AdminPostList; error?: string }>({});
  const [pending, setPending] = React.useState<Pending>(null);
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), status, category });
  if (query) params.set("q", query);
  const key = `${params}#${reload}`;
  React.useEffect(() => {
    let cancelled = false;
    blogApi<AdminPostList>(`/api/admin/blog/posts?${key.split("#")[0]}`).then(
      (data) => !cancelled && setState({ key, data }),
      (e: Error) => !cancelled && setState({ key, error: e.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [key]);
  const loading = state.key !== key;
  const data = state.data;
  const filtered = Boolean(query || category !== "all" || status !== "all");

  const act = async () => {
    if (!pending) return;
    setBusy(true);
    setActionError(null);
    const { kind, post } = pending;
    try {
      if (kind === "delete") await blogApi(`/api/admin/blog/posts/${post.id}`, { method: "DELETE", body: JSON.stringify({ version: post.version }) });
      else await blogApi(`/api/admin/blog/posts/${post.id}/${kind}`, { method: "POST", body: JSON.stringify({ version: post.version }) });
      setNotice(kind === "delete" ? `“${post.title}” was deleted.` : kind === "publish" ? `“${post.title}” is live on the blog.` : `“${post.title}” is now a draft.`);
      setPending(null);
      setReload((n) => n + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.8rem] font-medium text-muted-foreground">Content</p>
          <h1 className="font-heading mt-1.5 text-[1.6rem] leading-tight font-extrabold tracking-tight sm:text-[1.9rem]">Blog Management</h1>
          <p className="mt-1 max-w-2xl text-[0.95rem] text-muted-foreground">Write, preview and publish posts for the Sociotix blog. Drafts stay private and out of search engines until you publish them.</p>
        </div>
        <div className="flex shrink-0 gap-2 self-start sm:self-auto">
          <button type="button" onClick={() => setManaging(true)} className="inline-flex h-10 items-center gap-2 rounded-full border bg-card px-4 text-sm font-semibold hover:bg-muted focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none">
            <Tags className="size-4" aria-hidden /> Categories
          </button>
          {canManage ? (
            <Link href="/admin/blog/new" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-primary/35 focus-visible:outline-none">
              <Plus className="size-4" aria-hidden /> New post
            </Link>
          ) : null}
        </div>
      </header>

      {notice ? (
        <p role="status" className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-ok/25 bg-ok-soft px-4 py-2.5 text-sm font-medium text-ok">
          {notice}
          <button type="button" onClick={() => setNotice(null)} className="text-xs font-semibold underline">
            Dismiss
          </button>
        </p>
      ) : null}

      <Card className="mt-6 overflow-hidden" aria-busy={loading || undefined}>
        <div role="tablist" aria-label="Post status" className="flex gap-1 overflow-x-auto border-b px-3 pt-2 sm:px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={status === t.id}
              onClick={() => (setStatus(t.id), setPage(1))}
              className={cn("-mb-px inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors", status === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {t.label}
              {data ? <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] tabular-nums">{data.counts[t.id]}</span> : null}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="relative flex-1">
            <label htmlFor="blog-admin-search" className="sr-only">
              Search posts
            </label>
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              id="blog-admin-search"
              type="search"
              value={q}
              maxLength={100}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title, URL, author or tag"
              autoComplete="off"
              className="h-10 w-full rounded-xl border bg-background ps-9 text-sm transition-colors outline-none hover:border-foreground/20 focus-visible:border-primary/50 focus-visible:ring-3 focus-visible:ring-primary/15 dark:bg-muted/30"
            />
          </div>
          <SelectInput aria-label="Category" value={category} onChange={(e) => (setCategory(e.target.value), setPage(1))} className="h-10 sm:w-56">
            <option value="all">All categories</option>
            {cats.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectInput>
        </div>

        <p className="border-t px-4 py-2.5 text-xs text-muted-foreground sm:px-5" aria-live="polite">
          {data && !loading ? `${data.total} post${data.total === 1 ? "" : "s"}${filtered ? " match" : ""}` : " "}
        </p>

        {state.error && !loading ? (
          <div role="alert" className="flex flex-col items-center border-t px-6 py-14 text-center">
            <p className="font-heading text-lg font-bold">Posts didn&apos;t load</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{state.error}</p>
            <button type="button" onClick={() => setReload((n) => n + 1)} className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border bg-card px-4 text-sm font-semibold hover:bg-muted">
              <RotateCcw className="size-4" aria-hidden /> Try again
            </button>
          </div>
        ) : !data ? (
          <div className="space-y-2 border-t p-4 sm:p-5" aria-label="Loading posts">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <div className="flex flex-col items-center border-t px-6 py-14 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary" aria-hidden>
              <Newspaper className="size-5" />
            </span>
            <p className="mt-4 font-heading text-lg font-bold">{filtered ? "No posts match" : "No posts yet"}</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{filtered ? "Try a different search or clear the filters." : "Write your first post. It stays a private draft until you publish it."}</p>
            {filtered ? (
              <button type="button" onClick={() => (setQ(""), setQuery(""), setCategory("all"), setStatus("all"), setPage(1))} className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border bg-card px-4 text-sm font-semibold hover:bg-muted">
                Clear filters
              </button>
            ) : canManage ? (
              <Link href="/admin/blog/new" className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                <Plus className="size-4" aria-hidden /> New post
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <div className="hidden xl:block">
              <table className="w-full table-fixed text-sm">
                <caption className="sr-only">Blog posts</caption>
                <thead className="border-y bg-muted/40 text-[0.68rem] tracking-wider text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="py-2.5 ps-5 text-start font-bold">Title</th>
                    <th scope="col" className="w-48 px-3 py-2.5 text-start font-bold">Category</th>
                    <th scope="col" className="w-40 px-3 py-2.5 text-start font-bold">Author</th>
                    <th scope="col" className="w-32 px-3 py-2.5 text-start font-bold">Status</th>
                    <th scope="col" className="w-52 px-3 py-2.5 text-start font-bold">Date</th>
                    <th scope="col" className="w-16 py-2.5 pe-5 text-end font-bold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.items.map((p) => (
                    <tr key={p.id} className="transition-colors hover:bg-muted/40">
                      <td className="py-3 ps-5">
                        <div className="flex items-center gap-3">
                          <Thumb post={p} />
                          <span className="min-w-0">
                            <Link href={canManage ? `/admin/blog/${p.id}/edit` : `/admin/blog/${p.id}/preview`} className="flex items-center gap-1.5 font-semibold hover:text-primary focus-visible:underline focus-visible:outline-none">
                              <span className="truncate">{p.title}</span>
                              {p.featured ? <Star className="size-3.5 shrink-0 fill-current text-soon" aria-label="Featured" /> : null}
                            </Link>
                            <span className="block truncate font-mono text-[0.75rem] text-muted-foreground">/blog/{p.slug}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[0.85rem]">{p.categoryName}</td>
                      <td className="truncate px-3 py-3 text-[0.85rem]">{p.authorName}</td>
                      <td className="px-3 py-3">
                        <PostStatus state={p.state} />
                      </td>
                      <td className="px-3 py-3 text-[0.8rem] text-muted-foreground">{when(p)}</td>
                      <td className="py-3 pe-5 text-end">
                        <RowActions post={p} canManage={canManage} onAct={(x) => (setActionError(null), setPending(x))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y border-t xl:hidden" aria-label="Blog posts">
              {data.items.map((p) => (
                <li key={p.id} className="flex items-start gap-3 px-4 py-4 sm:px-5">
                  <Thumb post={p} />
                  <div className="min-w-0 flex-1">
                    <Link href={canManage ? `/admin/blog/${p.id}/edit` : `/admin/blog/${p.id}/preview`} className="line-clamp-2 font-semibold hover:text-primary">
                      {p.title}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {p.categoryName} · {p.authorName}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <PostStatus state={p.state} />
                      <span>{when(p)}</span>
                    </div>
                  </div>
                  <RowActions post={p} canManage={canManage} onAct={(x) => (setActionError(null), setPending(x))} />
                </li>
              ))}
            </ul>
            {data.pages > 1 ? <Pagination page={page} pageCount={data.pages} total={data.total} pageSize={PAGE_SIZE} label="Post pages" onPage={setPage} /> : null}
          </>
        )}
      </Card>

      <CategoryManager open={managing} onClose={() => setManaging(false)} canManage={canManage} onChanged={() => (cats.reload(), setReload((n) => n + 1))} />

      <ConfirmDialog
        open={Boolean(pending)}
        busy={busy}
        error={actionError}
        danger={pending?.kind === "delete"}
        title={pending?.kind === "delete" ? "Delete this post?" : pending?.kind === "publish" ? "Publish this post?" : pending?.post.state === "scheduled" ? "Cancel the schedule?" : "Unpublish this post?"}
        description={
          pending?.kind === "delete" ? (
            <>
              “{pending.post.title}” will be permanently deleted{pending.post.state === "published" ? " and its page will stop working" : ""}. This can&apos;t be undone.
            </>
          ) : pending?.kind === "publish" ? (
            <>“{pending.post.title}” will appear on the blog, in the sitemap and in search results.</>
          ) : (
            <>“{pending?.post.title}” will become a private draft and leave the blog and sitemap.</>
          )
        }
        confirmLabel={pending?.kind === "delete" ? "Delete post" : pending?.kind === "publish" ? "Publish" : pending?.post.state === "scheduled" ? "Cancel schedule" : "Unpublish"}
        onConfirm={act}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
