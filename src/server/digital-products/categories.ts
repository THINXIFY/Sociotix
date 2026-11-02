import "server-only";
import { count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { type AdminCategory, slugify } from "@/lib/blog/admin";
import { DIGITAL_CATEGORIES, isBuiltInDigitalCategory } from "@/lib/digital-products";
import { audit } from "../audit";
import type { ClientInfo } from "../auth/sessions";
import type { Db, Executor } from "../db/client";
import { digitalCategories, digitalProducts } from "../db/schema";
import { AppError, errors } from "../errors";

/*
 * Marketplace categories: the eight built-in ones (in code, always available, can't be changed) plus custom
 * categories admins add. Products store the category slug; a custom category in use can't be deleted.
 * Same shape as blog categories (postCount = number of products) so the admin manager is shared.
 */

type Staff = { userId: string };
const field = (name: string, message: string) => new AppError("VALIDATION_FAILED", message, { details: { field: name } });

const CategoryInput = z.strictObject({
  name: z.string().trim().min(1, "Name the category.").max(60, "Keep the name under 60 characters."),
  description: z.string().trim().max(200).default(""),
});

async function productCounts(db: Executor) {
  const rows = await db.select({ category: digitalProducts.category, n: count() }).from(digitalProducts).groupBy(digitalProducts.category);
  return new Map(rows.map((r) => [r.category, r.n]));
}

export async function listDigitalCategories(db: Executor): Promise<AdminCategory[]> {
  const [counts, custom] = await Promise.all([productCounts(db), db.select().from(digitalCategories).orderBy(sql`lower(${digitalCategories.name})`)]);
  return [
    ...DIGITAL_CATEGORIES.map((c) => ({ id: c.id, key: null, name: c.name, description: "", builtIn: true, postCount: counts.get(c.id) ?? 0 })),
    ...custom.map((c) => ({ id: c.slug, key: c.id, name: c.name, description: c.description, builtIn: false, postCount: counts.get(c.slug) ?? 0 })),
  ];
}

/** A product's category must be built-in or an existing custom category. */
export async function assertDigitalCategory(db: Executor, id: string) {
  if (isBuiltInDigitalCategory(id)) return;
  const [row] = await db.select({ id: digitalCategories.id }).from(digitalCategories).where(eq(digitalCategories.slug, id));
  if (!row) throw field("category", "Choose a category from the list.");
}

async function assertNameFree(db: Executor, name: string, exceptKey: string | null) {
  if (DIGITAL_CATEGORIES.some((c) => c.name.toLowerCase() === name.toLowerCase())) throw field("name", "A built-in category already has that name.");
  const [taken] = await db.select({ id: digitalCategories.id }).from(digitalCategories).where(sql`lower(${digitalCategories.name}) = ${name.toLowerCase()}`);
  if (taken && taken.id !== exceptKey) throw field("name", "A category with that name already exists.");
}

export async function createDigitalCategory(db: Db, actor: Staff, raw: unknown, client: ClientInfo = {}): Promise<AdminCategory> {
  const d = CategoryInput.parse(raw);
  const slug = slugify(d.name).slice(0, 60).replace(/-+$/, "");
  if (!slug) throw field("name", "Use letters or numbers in the name.");
  if (isBuiltInDigitalCategory(slug) || slug === "all") throw field("name", "That name is reserved for a built-in category.");
  return db.transaction(async (tx) => {
    await assertNameFree(tx, d.name, null);
    const [clash] = await tx.select({ id: digitalCategories.id }).from(digitalCategories).where(eq(digitalCategories.slug, slug));
    if (clash) throw field("name", "A category with a very similar name already exists.");
    const [row] = await tx.insert(digitalCategories).values({ slug, name: d.name, description: d.description, createdBy: actor.userId }).returning();
    await audit(tx, { actorUserId: actor.userId, actorType: "staff", action: "digital_category.create", targetType: "digital_category", targetId: row.id, after: { slug, name: d.name }, ...client });
    return { id: row.slug, key: row.id, name: row.name, description: row.description, builtIn: false, postCount: 0 };
  });
}

const keyOf = (key: string) => {
  if (!z.uuid().safeParse(key).success) throw errors.notFound("That category");
  return key;
};

/** Renames a custom category (its slug stays the same, so products keep it). */
export async function updateDigitalCategory(db: Db, actor: Staff, key: string, raw: unknown, client: ClientInfo = {}): Promise<AdminCategory> {
  const d = CategoryInput.parse(raw);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(digitalCategories).where(eq(digitalCategories.id, keyOf(key))).for("update");
    if (!before) throw errors.notFound("That category");
    await assertNameFree(tx, d.name, before.id);
    const [row] = await tx.update(digitalCategories).set({ name: d.name, description: d.description, updatedAt: new Date() }).where(eq(digitalCategories.id, before.id)).returning();
    await audit(tx, { actorUserId: actor.userId, actorType: "staff", action: "digital_category.update", targetType: "digital_category", targetId: row.id, before: { name: before.name }, after: { name: row.name }, ...client });
    const counts = await productCounts(tx);
    return { id: row.slug, key: row.id, name: row.name, description: row.description, builtIn: false, postCount: counts.get(row.slug) ?? 0 };
  });
}

/** Deletes an unused custom category. Built-in categories have no row and can't be deleted. */
export async function deleteDigitalCategory(db: Db, actor: Staff, key: string, client: ClientInfo = {}) {
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(digitalCategories).where(eq(digitalCategories.id, keyOf(key))).for("update");
    if (!before) throw errors.notFound("That category");
    const [{ n }] = await tx.select({ n: count() }).from(digitalProducts).where(eq(digitalProducts.category, before.slug));
    if (n > 0) throw errors.conflict(`${n} product${n === 1 ? " uses" : "s use"} this category. Move ${n === 1 ? "it" : "them"} to another category first.`);
    await tx.delete(digitalCategories).where(eq(digitalCategories.id, before.id));
    await audit(tx, { actorUserId: actor.userId, actorType: "staff", action: "digital_category.delete", targetType: "digital_category", targetId: before.id, before: { slug: before.slug, name: before.name }, ...client });
  });
}
