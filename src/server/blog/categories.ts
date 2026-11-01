import "server-only";
import { count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { type AdminCategory, slugify } from "@/lib/blog/admin";
import { BLOG_CATEGORIES, isBuiltInCategory } from "@/lib/blog/types";
import { audit } from "../audit";
import type { ClientInfo } from "../auth/sessions";
import type { Db, Executor } from "../db/client";
import { blogCategories, blogPosts } from "../db/schema";
import { AppError, errors } from "../errors";

/*
 * Blog categories: the six built-in ones (in code, always available, can't be changed) plus custom
 * categories admins add. Posts store the category id/slug; a custom category in use can't be deleted.
 */

type Staff = { userId: string };
const field = (name: string, message: string) => new AppError("VALIDATION_FAILED", message, { details: { field: name } });

const CategoryInput = z.strictObject({
  name: z.string().trim().min(1, "Name the category.").max(60, "Keep the name under 60 characters."),
  description: z.string().trim().max(200).default(""),
});

async function postCounts(db: Executor) {
  const rows = await db.select({ category: blogPosts.category, n: count() }).from(blogPosts).groupBy(blogPosts.category);
  return new Map(rows.map((r) => [r.category, r.n]));
}

export async function listCategories(db: Executor): Promise<AdminCategory[]> {
  const [counts, custom] = await Promise.all([postCounts(db), db.select().from(blogCategories).orderBy(sql`lower(${blogCategories.name})`)]);
  return [
    ...BLOG_CATEGORIES.map((c) => ({ id: c.id, key: null, name: c.name, description: "", builtIn: true, postCount: counts.get(c.id) ?? 0 })),
    ...custom.map((c) => ({ id: c.slug, key: c.id, name: c.name, description: c.description, builtIn: false, postCount: counts.get(c.slug) ?? 0 })),
  ];
}

/** Display names of custom categories by slug (built-in names come from code). */
export async function customCategoryNames(db: Executor) {
  const rows = await db.select({ slug: blogCategories.slug, name: blogCategories.name }).from(blogCategories);
  return new Map(rows.map((r) => [r.slug, r.name]));
}

/** A post's category must be built-in or an existing custom category. */
export async function assertCategory(db: Executor, id: string) {
  if (isBuiltInCategory(id)) return;
  const [row] = await db.select({ id: blogCategories.id }).from(blogCategories).where(eq(blogCategories.slug, id));
  if (!row) throw field("category", "Choose a category from the list.");
}

async function assertNameFree(db: Executor, name: string, exceptKey: string | null) {
  if (BLOG_CATEGORIES.some((c) => c.name.toLowerCase() === name.toLowerCase())) throw field("name", "A built-in category already has that name.");
  const [taken] = await db.select({ id: blogCategories.id }).from(blogCategories).where(sql`lower(${blogCategories.name}) = ${name.toLowerCase()}`);
  if (taken && taken.id !== exceptKey) throw field("name", "A category with that name already exists.");
}

export async function createCategory(db: Db, actor: Staff, raw: unknown, client: ClientInfo = {}): Promise<AdminCategory> {
  const d = CategoryInput.parse(raw);
  const slug = slugify(d.name).slice(0, 60).replace(/-+$/, "");
  if (!slug) throw field("name", "Use letters or numbers in the name.");
  if (isBuiltInCategory(slug)) throw field("name", "That name is reserved for a built-in category.");
  return db.transaction(async (tx) => {
    await assertNameFree(tx, d.name, null);
    const [clash] = await tx.select({ id: blogCategories.id }).from(blogCategories).where(eq(blogCategories.slug, slug));
    if (clash) throw field("name", "A category with a very similar name already exists.");
    const [row] = await tx.insert(blogCategories).values({ slug, name: d.name, description: d.description, createdBy: actor.userId }).returning();
    await audit(tx, { actorUserId: actor.userId, actorType: "staff", action: "blog_category.create", targetType: "blog_category", targetId: row.id, after: { slug, name: d.name }, ...client });
    return { id: row.slug, key: row.id, name: row.name, description: row.description, builtIn: false, postCount: 0 };
  });
}

const keyOf = (key: string) => {
  if (!z.uuid().safeParse(key).success) throw errors.notFound("That category");
  return key;
};

/** Renames a custom category (its id stays the same, so posts keep it). */
export async function updateCategory(db: Db, actor: Staff, key: string, raw: unknown, client: ClientInfo = {}): Promise<AdminCategory> {
  const d = CategoryInput.parse(raw);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(blogCategories).where(eq(blogCategories.id, keyOf(key))).for("update");
    if (!before) throw errors.notFound("That category");
    await assertNameFree(tx, d.name, before.id);
    const [row] = await tx.update(blogCategories).set({ name: d.name, description: d.description, updatedAt: new Date() }).where(eq(blogCategories.id, before.id)).returning();
    await audit(tx, { actorUserId: actor.userId, actorType: "staff", action: "blog_category.update", targetType: "blog_category", targetId: row.id, before: { name: before.name }, after: { name: row.name }, ...client });
    const counts = await postCounts(tx);
    return { id: row.slug, key: row.id, name: row.name, description: row.description, builtIn: false, postCount: counts.get(row.slug) ?? 0 };
  });
}

/** Deletes an unused custom category. Built-in categories have no row and can't be deleted. */
export async function deleteCategory(db: Db, actor: Staff, key: string, client: ClientInfo = {}) {
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(blogCategories).where(eq(blogCategories.id, keyOf(key))).for("update");
    if (!before) throw errors.notFound("That category");
    const [{ n }] = await tx.select({ n: count() }).from(blogPosts).where(eq(blogPosts.category, before.slug));
    if (n > 0) throw errors.conflict(`${n} post${n === 1 ? " uses" : "s use"} this category. Move ${n === 1 ? "it" : "them"} to another category first.`);
    await tx.delete(blogCategories).where(eq(blogCategories.id, before.id));
    await audit(tx, { actorUserId: actor.userId, actorType: "staff", action: "blog_category.delete", targetType: "blog_category", targetId: before.id, before: { slug: before.slug, name: before.name }, ...client });
  });
}
