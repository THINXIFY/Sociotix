import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { type CustomerLibrary, type DownloadRecord, fileDownloadHref, type LibraryItem, linkDownloadHref } from "@/lib/digital-products/library";
import type { Executor } from "../db/client";
import { auditLog, digitalProductFiles, digitalProducts } from "../db/schema";
import { toAdminProduct } from "./products";
import { toDigitalProduct } from "./public";

/*
 * The customer's Digital Library. A customer can access a product only when it is published, released and
 * free: purchasing isn't open, so there are no purchase entitlements and paid products never appear here.
 * Download history comes from the audit log entries the download endpoints write; nothing is invented.
 */

type Row = typeof digitalProducts.$inferSelect;

/** The one rule for customer access (also used by the download endpoints). */
export const customerCanAccess = (p: Pick<Row, "status" | "availability" | "pricing">) => p.status === "published" && p.availability === "available" && p.pricing === "free";

const accessible = and(eq(digitalProducts.status, "published"), eq(digitalProducts.availability, "available"), eq(digitalProducts.pricing, "free"));

const HISTORY_LIMIT = 50;

async function downloadEntries(db: Executor, userId: string, limit: number) {
  return db
    .select({ id: auditLog.id, at: auditLog.at, productId: auditLog.targetId, after: auditLog.after })
    .from(auditLog)
    .where(and(eq(auditLog.actorUserId, userId), eq(auditLog.action, "digital_product.download")))
    .orderBy(desc(auditLog.at))
    .limit(limit);
}

type AfterSnapshot = { fileId?: string; linkId?: string; filename?: string; label?: string; version?: string; title?: string };

export async function customerLibrary(db: Executor, userId: string): Promise<CustomerLibrary> {
  const rows = await db.select().from(digitalProducts).where(accessible).orderBy(desc(digitalProducts.publishedAt)).limit(200);
  const entries = await downloadEntries(db, userId, HISTORY_LIMIT);

  // Last download per product, and the newest file per product, to tell the customer about updates.
  const lastByProduct = new Map<string, Date>();
  for (const e of entries) if (e.productId && !lastByProduct.has(e.productId)) lastByProduct.set(e.productId, e.at);
  const newestFiles = rows.length
    ? await db
        .select({ productId: digitalProductFiles.productId, newest: sql<Date>`max(${digitalProductFiles.createdAt})`.mapWith((v) => new Date(v)) })
        .from(digitalProductFiles)
        .where(inArray(digitalProductFiles.productId, rows.map((r) => r.id)))
        .groupBy(digitalProductFiles.productId)
    : [];
  const newestByProduct = new Map(newestFiles.map((f) => [f.productId, f.newest]));

  const items: LibraryItem[] = await Promise.all(
    rows.map(async (r) => {
      const last = lastByProduct.get(r.id) ?? null;
      const newest = newestByProduct.get(r.id);
      return {
        product: toDigitalProduct(await toAdminProduct(db, r)),
        updatedAt: r.updatedAt.toISOString(),
        lastDownloadedAt: last?.toISOString() ?? null,
        hasUpdate: Boolean(last && newest && newest > last),
      };
    }),
  );

  const history = await historyRecords(db, entries);
  return {
    items,
    history,
    summary: {
      products: items.length,
      files: items.reduce((n, i) => n + (i.product.downloads?.files.length ?? 0), 0),
      links: items.reduce((n, i) => n + (i.product.downloads?.links.length ?? 0), 0),
    },
  };
}

/** Each download with what it was, and whether it can be downloaded again right now. */
async function historyRecords(db: Executor, entries: Awaited<ReturnType<typeof downloadEntries>>): Promise<DownloadRecord[]> {
  const productIds = [...new Set(entries.map((e) => e.productId).filter((x): x is string => Boolean(x)))];
  const products = productIds.length ? await db.select().from(digitalProducts).where(inArray(digitalProducts.id, productIds)) : [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const fileIds = [...new Set(entries.map((e) => (e.after as AfterSnapshot | null)?.fileId).filter((x): x is string => Boolean(x)))];
  const files = fileIds.length ? await db.select({ id: digitalProductFiles.id, productId: digitalProductFiles.productId, filename: digitalProductFiles.filename, version: digitalProductFiles.version }).from(digitalProductFiles).where(inArray(digitalProductFiles.id, fileIds)) : [];
  const fileById = new Map(files.map((f) => [f.id, f]));

  return entries.map((e) => {
    const a = (e.after ?? {}) as AfterSnapshot;
    const p = e.productId ? byId.get(e.productId) : undefined;
    const base = { id: String(e.id), at: e.at.toISOString(), productTitle: p?.title ?? a.title ?? "Removed product", productSlug: p && p.status === "published" ? p.slug : null };
    if (a.fileId) {
      const f = fileById.get(a.fileId);
      const exists = Boolean(p && f && f.productId === p.id);
      const allowed = Boolean(p && customerCanAccess(p));
      return { ...base, kind: "file" as const, name: f?.filename ?? a.filename ?? "File", version: f?.version ?? a.version ?? "", href: exists && allowed ? fileDownloadHref(p!.slug, a.fileId) : null, ...(exists && allowed ? {} : { unavailable: !exists ? ("removed" as const) : ("no_access" as const) }) };
    }
    const link = p?.downloadLinks.find((l) => l.id === a.linkId);
    const allowed = Boolean(p && customerCanAccess(p));
    return { ...base, kind: "link" as const, name: link?.label ?? a.label ?? "Download link", version: "", href: link && allowed ? linkDownloadHref(p!.slug, link.id) : null, ...(link && allowed ? {} : { unavailable: !link ? ("removed" as const) : ("no_access" as const) }) };
  });
}

/** One product in the customer's library, or null when they can't access it. */
export async function customerLibraryItem(db: Executor, userId: string, slug: string): Promise<LibraryItem | null> {
  const [r] = await db.select().from(digitalProducts).where(and(accessible, eq(digitalProducts.slug, slug)));
  if (!r) return null;
  const [last] = await db
    .select({ at: auditLog.at })
    .from(auditLog)
    .where(and(eq(auditLog.actorUserId, userId), eq(auditLog.action, "digital_product.download"), eq(auditLog.targetId, r.id)))
    .orderBy(desc(auditLog.at))
    .limit(1);
  const product = toDigitalProduct(await toAdminProduct(db, r));
  const [newest] = await db.select({ at: sql<Date>`max(${digitalProductFiles.createdAt})`.mapWith((v) => (v ? new Date(v) : null)) }).from(digitalProductFiles).where(eq(digitalProductFiles.productId, r.id));
  return { product, updatedAt: r.updatedAt.toISOString(), lastDownloadedAt: last?.at.toISOString() ?? null, hasUpdate: Boolean(last && newest?.at && newest.at > last.at) };
}
