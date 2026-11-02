import "server-only";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { MAX_PRODUCT_FILE_BYTES, type ProductFile } from "@/lib/digital-products/admin";
import { audit } from "../audit";
import type { ClientInfo } from "../auth/sessions";
import type { Db, Executor } from "../db/client";
import { digitalProductFiles, digitalProducts } from "../db/schema";
import { AppError, errors } from "../errors";

/*
 * Product download files. Stored privately in PostgreSQL (never under /public) and served only by the
 * permission-checked download route. A file is accepted by its bytes, not its name or declared type.
 */

type Staff = { userId: string };
export type FileMime = "application/zip" | "application/pdf" | "application/epub+zip" | "image/png" | "image/jpeg" | "image/webp";
const invalid = (message: string) => new AppError("VALIDATION_FAILED", message, { details: { field: "file" } });
const MAX_FILES = 20;

/** Identifies a file by its signature. EPUB is a ZIP whose first entry is the "mimetype" file. */
export function inspectProductFile(b: Buffer): FileMime {
  if (!b.length) throw invalid("That file is empty.");
  if (b.length > MAX_PRODUCT_FILE_BYTES) throw invalid("Files can be up to 8 MB.");
  if (b.length > 4 && b.readUInt32BE(0) === 0x504b0304) {
    if (b.length > 58 && b.toString("latin1", 30, 38) === "mimetype" && b.toString("latin1", 38, 58) === "application/epub+zip") return "application/epub+zip";
    return "application/zip";
  }
  if (b.length > 22 && b.readUInt32BE(0) === 0x504b0506) return "application/zip"; // empty archive
  if (b.toString("latin1", 0, 5) === "%PDF-") return "application/pdf";
  if (b.length > 8 && b.readUInt32BE(0) === 0x89504e47 && b.readUInt32BE(4) === 0x0d0a1a0a) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  throw invalid("Use a ZIP, PDF, EPUB, PNG, JPEG or WebP file.");
}

const EXT: Record<FileMime, string> = { "application/zip": "zip", "application/pdf": "pdf", "application/epub+zip": "epub", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** A safe download name: no paths or control characters, and an extension that matches the real type. */
export function cleanFilename(raw: string, mime: FileMime) {
  const base = (raw.split(/[\\/]/).pop() ?? "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} ._()+-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  const stem = base.replace(/\.[A-Za-z0-9]{1,8}$/, "").slice(0, 140) || "download";
  return `${stem}.${mime === "image/jpeg" && /\.jpeg$/i.test(base) ? "jpeg" : EXT[mime]}`;
}

const VersionInput = z.strictObject({ version: z.string().trim().max(40, "Keep the version under 40 characters.").default("") });

const toFile = (r: Pick<typeof digitalProductFiles.$inferSelect, "id" | "filename" | "mime" | "sizeBytes" | "version" | "createdAt">): ProductFile => ({ id: r.id, filename: r.filename, mime: r.mime, sizeBytes: r.sizeBytes, version: r.version, createdAt: r.createdAt.toISOString() });

const uuidOk = (id: string) => z.uuid().safeParse(id).success;

async function productFor(tx: Executor, productId: string) {
  if (!uuidOk(productId)) throw errors.notFound("That product");
  const [p] = await tx.select({ id: digitalProducts.id, version: digitalProducts.version }).from(digitalProducts).where(eq(digitalProducts.id, productId)).for("update");
  if (!p) throw errors.notFound("That product");
  return p;
}

/** Touch the product so its version moves on (editors holding the old version then reload before saving). */
const bump = (tx: Executor, productId: string, actor: Staff) =>
  tx
    .update(digitalProducts)
    .set({ version: sql`${digitalProducts.version} + 1`, updatedAt: new Date(), updatedBy: actor.userId })
    .where(eq(digitalProducts.id, productId));

export async function addProductFile(db: Db, actor: Staff, productId: string, upload: { name: string; bytes: Buffer; version?: string }, client: ClientInfo = {}) {
  const mime = inspectProductFile(upload.bytes);
  const { version } = VersionInput.parse({ version: upload.version ?? "" });
  const filename = cleanFilename(upload.name, mime);
  return db.transaction(async (tx) => {
    await productFor(tx, productId);
    const [{ n, next }] = await tx
      .select({ n: sql<number>`count(*)`.mapWith(Number), next: sql<number>`coalesce(max(${digitalProductFiles.position}) + 1, 0)`.mapWith(Number) })
      .from(digitalProductFiles)
      .where(eq(digitalProductFiles.productId, productId));
    if (n >= MAX_FILES) throw invalid(`A product can have up to ${MAX_FILES} files.`);
    const sha256 = createHash("sha256").update(upload.bytes).digest("hex");
    const [r] = await tx.insert(digitalProductFiles).values({ productId, filename, mime, sizeBytes: upload.bytes.length, bytes: upload.bytes, sha256, version, position: next, uploadedBy: actor.userId }).returning();
    const [p] = await bump(tx, productId, actor).returning({ version: digitalProducts.version });
    await audit(tx, { actorUserId: actor.userId, actorType: "staff", action: "digital_product.file_add", targetType: "digital_product", targetId: productId, after: { fileId: r.id, filename, mime, sizeBytes: r.sizeBytes, version }, ...client });
    return { file: toFile(r), productVersion: p.version };
  });
}

export async function updateProductFile(db: Db, actor: Staff, productId: string, fileId: string, raw: unknown, client: ClientInfo = {}) {
  const { version } = VersionInput.parse(raw);
  if (!uuidOk(fileId)) throw errors.notFound("That file");
  return db.transaction(async (tx) => {
    await productFor(tx, productId);
    const [before] = await tx.select({ version: digitalProductFiles.version }).from(digitalProductFiles).where(and(eq(digitalProductFiles.id, fileId), eq(digitalProductFiles.productId, productId)));
    if (!before) throw errors.notFound("That file");
    const [r] = await tx.update(digitalProductFiles).set({ version }).where(eq(digitalProductFiles.id, fileId)).returning();
    const [p] = await bump(tx, productId, actor).returning({ version: digitalProducts.version });
    await audit(tx, { actorUserId: actor.userId, actorType: "staff", action: "digital_product.file_update", targetType: "digital_product", targetId: productId, before: { fileId, version: before.version }, after: { fileId, version }, ...client });
    return { file: toFile(r), productVersion: p.version };
  });
}

export async function deleteProductFile(db: Db, actor: Staff, productId: string, fileId: string, client: ClientInfo = {}) {
  if (!uuidOk(fileId)) throw errors.notFound("That file");
  return db.transaction(async (tx) => {
    await productFor(tx, productId);
    const [gone] = await tx.delete(digitalProductFiles).where(and(eq(digitalProductFiles.id, fileId), eq(digitalProductFiles.productId, productId))).returning({ filename: digitalProductFiles.filename });
    if (!gone) throw errors.notFound("That file");
    const [p] = await bump(tx, productId, actor).returning({ version: digitalProducts.version });
    await audit(tx, { actorUserId: actor.userId, actorType: "staff", action: "digital_product.file_delete", targetType: "digital_product", targetId: productId, before: { fileId, filename: gone.filename }, ...client });
    return { productVersion: p.version };
  });
}

/** Bytes for the download route (after it has checked permission). */
export async function getProductFileBytes(db: Executor, productId: string, fileId: string) {
  if (!uuidOk(fileId) || !uuidOk(productId)) return null;
  const [r] = await db
    .select({ filename: digitalProductFiles.filename, version: digitalProductFiles.version, mime: digitalProductFiles.mime, bytes: digitalProductFiles.bytes, sha256: digitalProductFiles.sha256 })
    .from(digitalProductFiles)
    .where(and(eq(digitalProductFiles.id, fileId), eq(digitalProductFiles.productId, productId)));
  return r ?? null;
}
