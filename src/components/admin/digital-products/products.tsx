"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Copy, ExternalLink, Eye, LayoutGrid, MoreHorizontal, PencilLine, Plus, RotateCcw, Search, Send, Tags, Trash2, Undo2 } from "lucide-react";
import { Menu } from "@base-ui/react/menu";
import { CategoryManager, useCategories } from "@/components/admin/blog/categories";
import { blogApi, ConfirmDialog } from "@/components/admin/blog/shared";
import { Pagination } from "@/components/dashboard/shared";
import { menuItem, menuItemDestructive, menuPopup } from "@/components/ui/menu";
import type { AdminProduct, AdminProductList, AdminProductRow, ProductStatus } from "@/lib/digital-products/admin";
import { formatDate } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SelectInput } from "../form";
import { Card } from "../ui";
import { adminPriceLabel, PRODUCT_CATEGORY_SCOPE, ProductStatusBadge } from "./shared";

/* Admin → Digital Products: every marketplace product with search, filters, sorting, paging and row actions. */

const PAGE_SIZE = 15;
const TABS: { id: ProductStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts" },
  { id: "published", label: "Published" },
  { id: "archived", label: "Archived" },
];
const SORTS = [
  { id: "updated", label: "Recently edited" },
  { id: "newest", label: "Newest first" },
  { id: "title", label: "Name A–Z" },
  { id: "price", label: "Price: high to low" },
] as const;

type Kind = "publish" | "unpublish" | "archive" | "delete";
type Pending = { kind: Kind; product: AdminProductRow } | null;

function Thumb({ product }: { product: AdminProductRow }) {
  return (
    <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary text-primary" aria-hidden>
      {product.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element -- uploaded image thumbnail
        <img src={product.thumbnail.src} alt="" width={48} height={48} className="size-full object-cover" loading="lazy" />
      ) : (
        <LayoutGrid className="size-5" />
      )}
    </span>
  );
}

const when = (p: AdminProductRow) => (p.status === "published" && p.publishedAt ? `Published ${formatDate(p.publishedAt, { year: true })}` : `Edited ${formatDate(p.updatedAt, { year: true })}`);

function RowActions({ product: p, canManage, onAct, onDuplicate }: { product: AdminProductRow; canManage: boolean; onAct: (x: Pending) => void; onDuplicate: (p: AdminProductRow) => void }) {
  return (
    <Menu.Root>
      <Menu.Trigger aria-label={`Actions for ${p.title}`} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none">
        <MoreHorizontal className="size-4" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-50 outline-none">
          <Menu.Popup className={cn(menuPopup, "min-w-48")}>
            {canManage ? (
              <Menu.Item render={<Link href={`/admin/digital-products/${p.id}/edit`} />} className={menuItem}>
                <PencilLine className="size-4" aria-hidden /> Edit
              </Menu.Item>
            ) : null}
            <Menu.Item render={<Link href={`/admin/digital-products/${p.id}/preview`} />} className={menuItem}>
              <Eye className="size-4" aria-hidden /> Preview
            </Menu.Item>
            {p.status === "published" ? (
              <Menu.Item render={<a href={`/digital-products/${p.slug}`} target="_blank" rel="noopener noreferrer" />} className={menuItem}>
                <ExternalLink className="size-4" aria-hidden /> View on marketplace
              </Menu.Item>
            ) : null}
            {canManage ? (
              <>
                <Menu.Item onClick={() => onDuplicate(p)} className={menuItem}>
                  <Copy className="size-4" aria-hidden /> Duplicate
                </Menu.Item>
                {p.status === "published" ? (
                  <Menu.Item onClick={() => onAct({ kind: "unpublish", product: p })} className={menuItem}>
                    <Undo2 className="size-4" aria-hidden /> Unpublish
                  </Menu.Item>
                ) : (
                  <Menu.Item onClick={() => onAct({ kind: "publish", product: p })} className={menuItem}>
                    <Send className="size-4" aria-hidden /> Publish
                  </Menu.Item>
                )}
                {p.status !== "archived" ? (
                  <Menu.Item onClick={() => onAct({ kind: "archive", product: p })} className={menuItem}>
                    <Archive className="size-4" aria-hidden /> Archive
                  </Menu.Item>
                ) : null}
                <Menu.Item onClick={() => onAct({ kind: "delete", product: p })} className={cn(menuItem, menuItemDestructive)}>
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

const CONFIRM: Record<Kind, { title: string; label: string; text: (p: AdminProductRow) => React.ReactNode }> = {
  publish: { title: "Publish this product?", label: "Publish", text: (p) => <>“{p.title}” will appear on the marketplace, in the sitemap and in search results. Publishing doesn&apos;t enable purchases.</> },
  unpublish: { title: "Unpublish this product?", label: "Unpublish", text: (p) => <>“{p.title}” will become a private draft and leave the marketplace and sitemap.</> },
  archive: { title: "Archive this product?", label: "Archive", text: (p) => <>“{p.title}” will be kept for your records but hidden from the marketplace{p.status === "published" ? ", and its page will stop working" : ""}.</> },
  delete: { title: "Delete this product?", label: "Delete product", text: (p) => <>“{p.title}” and its uploaded files will be permanently deleted{p.status === "published" ? " and its page will stop working" : ""}. This can&apos;t be undone.</> },
};
const DONE: Record<Kind, (t: string) => string> = {
  publish: (t) => `“${t}” is live on the marketplace.`,
  unpublish: (t) => `“${t}” is now a draft.`,
  archive: (t) => `“${t}” was archived.`,
  delete: (t) => `“${t}” was deleted.`,
};

export function DigitalProducts({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [sort, setSort] = React.useState<(typeof SORTS)[number]["id"]>("updated");
  const [status, setStatus] = React.useState<ProductStatus | "all">("all");
  const [page, setPage] = React.useState(1);
  const [reload, setReload] = React.useState(0);
  const [managing, setManaging] = React.useState(false);
  const cats = useCategories(PRODUCT_CATEGORY_SCOPE);
  const [state, setState] = React.useState<{ key?: string; data?: AdminProductList; error?: string }>({});
  const [pending, setPending] = React.useState<Pending>(null);
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), status, category, sort });
  if (query) params.set("q", query);
  const key = `${params}#${reload}`;
  React.useEffect(() => {
    let cancelled = false;
    blogApi<AdminProductList>(`/api/admin/digital-products?${key.split("#")[0]}`).then(
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
    const { kind, product } = pending;
    try {
      if (kind === "delete") await blogApi(`/api/admin/digital-products/${product.id}`, { method: "DELETE", body: JSON.stringify({ version: product.version }) });
      else await blogApi(`/api/admin/digital-products/${product.id}/${kind}`, { method: "POST", body: JSON.stringify({ version: product.version }) });
      setNotice(DONE[kind](product.title));
      setPending(null);
      setReload((n) => n + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (p: AdminProductRow) => {
    setNotice(null);
    setFailure(null);
    try {
      const { product } = await blogApi<{ product: AdminProduct }>(`/api/admin/digital-products/${p.id}/duplicate`, { method: "POST", body: "{}" });
      router.push(`/admin/digital-products/${product.id}/edit`);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "That product couldn't be duplicated.");
    }
  };

  const metrics = data
    ? [
        { label: "Products", value: data.counts.all },
        { label: "Published", value: data.counts.published },
        { label: "Drafts", value: data.counts.draft },
        { label: "Free", value: data.metrics.free },
        { label: "Paid", value: data.metrics.paid },
        { label: "With downloads", value: data.metrics.withDownloads },
      ]
    : null;

  return (
    <div className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.8rem] font-medium text-muted-foreground">Content</p>
          <h1 className="font-heading mt-1.5 text-[1.6rem] leading-tight font-extrabold tracking-tight sm:text-[1.9rem]">Digital Products</h1>
          <p className="mt-1 max-w-2xl text-[0.95rem] text-muted-foreground">Create and publish products for the Digital Products Marketplace. Drafts stay private. Purchasing isn&apos;t open yet: publishing shows a product, it doesn&apos;t sell it.</p>
        </div>
        <div className="flex shrink-0 gap-2 self-start sm:self-auto">
          <button type="button" onClick={() => setManaging(true)} className="inline-flex h-10 items-center gap-2 rounded-full border bg-card px-4 text-sm font-semibold hover:bg-muted focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none">
            <Tags className="size-4" aria-hidden /> Categories
          </button>
          {canManage ? (
            <Link href="/admin/digital-products/new" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-primary/35 focus-visible:outline-none">
              <Plus className="size-4" aria-hidden /> New product
            </Link>
          ) : null}
        </div>
      </header>

      {metrics ? (
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="Summary">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-2xl border bg-card px-4 py-3">
              <dt className="text-xs text-muted-foreground">{m.label}</dt>
              <dd className="mt-0.5 font-heading text-xl font-extrabold tabular-nums">{m.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {failure ? (
        <p role="alert" className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm font-medium text-destructive">
          {failure}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-ok/25 bg-ok-soft px-4 py-2.5 text-sm font-medium text-ok">
          {notice}
          <button type="button" onClick={() => setNotice(null)} className="text-xs font-semibold underline">
            Dismiss
          </button>
        </p>
      ) : null}

      <Card className="mt-6 overflow-hidden" aria-busy={loading || undefined}>
        <div role="tablist" aria-label="Product status" className="flex gap-1 overflow-x-auto border-b px-3 pt-2 sm:px-4">
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
            <label htmlFor="dp-admin-search" className="sr-only">
              Search products
            </label>
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              id="dp-admin-search"
              type="search"
              value={q}
              maxLength={100}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, URL or tag"
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
          <SelectInput aria-label="Sort" value={sort} onChange={(e) => (setSort(e.target.value as typeof sort), setPage(1))} className="h-10 sm:w-48">
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </SelectInput>
        </div>

        <p className="border-t px-4 py-2.5 text-xs text-muted-foreground sm:px-5" aria-live="polite">
          {data && !loading ? `${data.total} product${data.total === 1 ? "" : "s"}${filtered ? " match" : ""}` : " "}
        </p>

        {state.error && !loading ? (
          <div role="alert" className="flex flex-col items-center border-t px-6 py-14 text-center">
            <p className="font-heading text-lg font-bold">Products didn&apos;t load</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{state.error}</p>
            <button type="button" onClick={() => setReload((n) => n + 1)} className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border bg-card px-4 text-sm font-semibold hover:bg-muted">
              <RotateCcw className="size-4" aria-hidden /> Try again
            </button>
          </div>
        ) : !data ? (
          <div className="space-y-2 border-t p-4 sm:p-5" aria-label="Loading products">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <div className="flex flex-col items-center border-t px-6 py-14 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary" aria-hidden>
              <LayoutGrid className="size-5" />
            </span>
            <p className="mt-4 font-heading text-lg font-bold">{filtered ? "No products match" : "No products yet"}</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{filtered ? "Try a different search or clear the filters." : "Create your first product. It stays a private draft until you publish it. Until then the marketplace shows its concept previews."}</p>
            {filtered ? (
              <button type="button" onClick={() => (setQ(""), setQuery(""), setCategory("all"), setStatus("all"), setPage(1))} className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border bg-card px-4 text-sm font-semibold hover:bg-muted">
                Clear filters
              </button>
            ) : canManage ? (
              <Link href="/admin/digital-products/new" className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                <Plus className="size-4" aria-hidden /> New product
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <div className="hidden xl:block">
              <table className="w-full table-fixed text-sm">
                <caption className="sr-only">Digital products</caption>
                <thead className="border-y bg-muted/40 text-[0.68rem] tracking-wider text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="py-2.5 ps-5 text-start font-bold">Product</th>
                    <th scope="col" className="w-52 px-3 py-2.5 text-start font-bold">Category</th>
                    <th scope="col" className="w-32 px-3 py-2.5 text-start font-bold">Price</th>
                    <th scope="col" className="w-32 px-3 py-2.5 text-start font-bold">Status</th>
                    <th scope="col" className="w-44 px-3 py-2.5 text-start font-bold">Date</th>
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
                          <Thumb product={p} />
                          <span className="min-w-0">
                            <Link href={canManage ? `/admin/digital-products/${p.id}/edit` : `/admin/digital-products/${p.id}/preview`} className="flex items-center gap-1.5 font-semibold hover:text-primary focus-visible:underline focus-visible:outline-none">
                              <span className="truncate">{p.title}</span>
                            </Link>
                            <span className="block truncate font-mono text-[0.75rem] text-muted-foreground">/digital-products/{p.slug}</span>
                          </span>
                        </div>
                      </td>
                      <td className="truncate px-3 py-3 text-[0.85rem]">{p.categoryName}</td>
                      <td className="px-3 py-3 text-[0.85rem]">{adminPriceLabel(p.pricing, p.priceCents, p.currency)}</td>
                      <td className="px-3 py-3">
                        <ProductStatusBadge status={p.status} />
                      </td>
                      <td className="px-3 py-3 text-[0.8rem] text-muted-foreground">{when(p)}</td>
                      <td className="py-3 pe-5 text-end">
                        <RowActions product={p} canManage={canManage} onDuplicate={duplicate} onAct={(x) => (setActionError(null), setPending(x))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y border-t xl:hidden" aria-label="Digital products">
              {data.items.map((p) => (
                <li key={p.id} className="flex items-start gap-3 px-4 py-4 sm:px-5">
                  <Thumb product={p} />
                  <div className="min-w-0 flex-1">
                    <Link href={canManage ? `/admin/digital-products/${p.id}/edit` : `/admin/digital-products/${p.id}/preview`} className="line-clamp-2 font-semibold hover:text-primary">
                      {p.title}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {p.categoryName} · {adminPriceLabel(p.pricing, p.priceCents, p.currency)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <ProductStatusBadge status={p.status} />
                      <span>{when(p)}</span>
                    </div>
                  </div>
                  <RowActions product={p} canManage={canManage} onDuplicate={duplicate} onAct={(x) => (setActionError(null), setPending(x))} />
                </li>
              ))}
            </ul>
            {data.pages > 1 ? <Pagination page={page} pageCount={data.pages} total={data.total} pageSize={PAGE_SIZE} label="Product pages" onPage={setPage} /> : null}
          </>
        )}
      </Card>

      <CategoryManager scope={PRODUCT_CATEGORY_SCOPE} open={managing} onClose={() => setManaging(false)} canManage={canManage} onChanged={() => (cats.reload(), setReload((n) => n + 1))} />

      <ConfirmDialog
        open={Boolean(pending)}
        busy={busy}
        error={actionError}
        danger={pending?.kind === "delete"}
        title={pending ? CONFIRM[pending.kind].title : ""}
        description={pending ? CONFIRM[pending.kind].text(pending.product) : ""}
        confirmLabel={pending ? CONFIRM[pending.kind].label : ""}
        onConfirm={act}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
