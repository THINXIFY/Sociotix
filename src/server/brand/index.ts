import "server-only";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  BRAND_AUDIENCE_MAX,
  BRAND_DEMOGRAPHICS_MAX,
  BRAND_DESCRIPTION_MAX,
  BRAND_GUIDELINES_MAX,
  BRAND_INDUSTRY_MAX,
  BRAND_LISTS,
  BRAND_NAME_MAX,
  BRAND_TONE_MAX,
  BRAND_WEBSITE_MAX,
  BRANDS_MAX,
  buildBrandContext,
  normalizeHex,
  normalizeWebsite,
  summaryOf,
  type BrandContext,
  type BrandSummary,
  type BrandView,
} from "@/lib/brand";
import { HASHTAGS_MAX } from "@/lib/social/content";
import { isSocialProvider, SOCIAL_PROVIDER_IDS } from "@/lib/social/platforms";
import { hit } from "../auth/rate-limit";
import type { Db, Executor } from "../db/client";
import { brands, contentMedia, socialPosts } from "../db/schema";
import { AppError, errors, pgErrorOf } from "../errors";

/**
 * Brand profiles (BR-01). Every function takes the signed-in customer's id and only ever reads or changes that
 * customer's rows; a brand or image that belongs to someone else is reported as "not found" / "isn't available".
 * Deleting a brand never deletes drafts or images.
 */

const isUuid = (s: string) => z.string().uuid().safeParse(s).success;

async function limitWrites(db: Executor, customerId: string) {
  const r = await hit(db, "brandWrites", customerId, { limit: 300, windowSeconds: 3600 });
  if (!r.ok) throw new AppError("RATE_LIMITED", "You've made a lot of changes in a short time. Please wait a few minutes.");
}

/* -------------------------------------------------------------------------- */
/*  Input                                                                     */
/* -------------------------------------------------------------------------- */

const oneLine = (s: string) => s.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
const multiLine = (s: string) =>
  s
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();

const line = (max: number, what: string) => z.string().transform(oneLine).refine((s) => Array.from(s).length <= max, `${what} can be up to ${max} characters.`);
const para = (max: number, what: string) => z.string().transform(multiLine).refine((s) => Array.from(s).length <= max, `${what} can be up to ${max.toLocaleString("en-US")} characters.`);

function list(key: keyof typeof BRAND_LISTS, what: string) {
  const { max, each } = BRAND_LISTS[key];
  return z
    .array(z.string())
    .transform((a) => a.map(oneLine).filter(Boolean))
    .transform((a) => a.filter((t, i) => a.findIndex((u) => u.toLowerCase() === t.toLowerCase()) === i))
    .refine((a) => a.length <= max, `Use up to ${max} ${what}.`)
    .refine((a) => a.every((t) => Array.from(t).length <= each), `Each of the ${what} can be up to ${each} characters.`);
}

const color = (what: string) =>
  z
    .string()
    .nullable()
    .transform((v, ctx) => {
      if (v === null || !v.trim()) return null;
      const hex = normalizeHex(v);
      if (!hex) ctx.addIssue({ code: "custom", message: `${what} must be a hex color like #7047EB.` });
      return hex;
    });

const fields = {
  name: line(BRAND_NAME_MAX, "A brand name").refine((s) => s.length >= 1, "Give the brand a name."),
  description: para(BRAND_DESCRIPTION_MAX, "The description"),
  website: z
    .string()
    .nullable()
    .transform((v, ctx) => {
      if (v === null || !v.trim()) return null;
      const w = normalizeWebsite(v);
      if (!w || w.length > BRAND_WEBSITE_MAX) ctx.addIssue({ code: "custom", message: "Enter a web address like https://example.com." });
      return w;
    }),
  industry: line(BRAND_INDUSTRY_MAX, "The industry"),
  logoMediaId: z.string().uuid().nullable(),
  coverMediaId: z.string().uuid().nullable(),
  primaryColor: color("The primary color"),
  secondaryColor: color("The secondary color"),
  accentColor: color("The accent color"),
  personality: list("personality", "personality traits"),
  toneOfVoice: para(BRAND_TONE_MAX, "Tone of voice"),
  audience: para(BRAND_AUDIENCE_MAX, "The audience description"),
  demographics: para(BRAND_DEMOGRAPHICS_MAX, "Demographics"),
  platforms: z.array(z.enum(SOCIAL_PROVIDER_IDS)).max(6).transform((a) => [...new Set(a)]),
  keywords: list("keywords", "keywords"),
  hashtags: z
    .array(z.string().normalize("NFC").pipe(z.string().regex(/^[\p{L}\p{N}_]{1,50}$/u, "Hashtags can use letters, numbers and underscores.")))
    .transform((a) => a.filter((t, i) => a.findIndex((u) => u.toLowerCase() === t.toLowerCase()) === i))
    .refine((a) => a.length <= HASHTAGS_MAX, `Use up to ${HASHTAGS_MAX} hashtags.`),
  writingGuidelines: para(BRAND_GUIDELINES_MAX, "Writing guidelines"),
  preferredPhrases: list("preferredPhrases", "preferred phrases"),
  avoidWords: list("avoidWords", "words to avoid"),
};

const createInput = z.strictObject({ ...fields }).partial().required({ name: true });
const updateInput = z.strictObject({ ...fields }).partial().extend({ expectedVersion: z.number().int().min(1) });

type Fields = Partial<{ [K in keyof typeof fields]: z.output<(typeof fields)[K]> }>;

/* -------------------------------------------------------------------------- */
/*  Views                                                                     */
/* -------------------------------------------------------------------------- */

type Row = typeof brands.$inferSelect;

function view(r: Row, postCount: number): BrandView {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    website: r.website,
    industry: r.industry,
    logoMediaId: r.logoMediaId,
    coverMediaId: r.coverMediaId,
    primaryColor: r.primaryColor,
    secondaryColor: r.secondaryColor,
    accentColor: r.accentColor,
    personality: r.personality,
    toneOfVoice: r.toneOfVoice,
    audience: r.audience,
    demographics: r.demographics,
    platforms: r.platforms.filter(isSocialProvider),
    keywords: r.keywords,
    hashtags: r.hashtags,
    writingGuidelines: r.writingGuidelines,
    preferredPhrases: r.preferredPhrases,
    avoidWords: r.avoidWords,
    isDefault: r.isDefault,
    postCount,
    version: r.version,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

async function withCounts(db: Executor, customerId: string, rows: Row[]): Promise<BrandView[]> {
  if (!rows.length) return [];
  const counts = await db
    .select({ brandId: socialPosts.brandId, n: count() })
    .from(socialPosts)
    .where(and(eq(socialPosts.customerId, customerId), inArray(socialPosts.brandId, rows.map((r) => r.id))))
    .groupBy(socialPosts.brandId);
  const by = new Map(counts.map((c) => [c.brandId, c.n]));
  return rows.map((r) => view(r, by.get(r.id) ?? 0));
}

/** The customer's brands, the default first, then by name. */
export async function listBrands(db: Db, customerId: string): Promise<BrandView[]> {
  const rows = await db.select().from(brands).where(eq(brands.customerId, customerId)).orderBy(sql`${brands.isDefault} desc`, sql`lower(${brands.name})`);
  return withCounts(db, customerId, rows);
}

/** Light summaries for pickers, badges and filters. */
export async function brandSummaries(db: Db, customerId: string): Promise<BrandSummary[]> {
  return (await listBrands(db, customerId)).map(summaryOf);
}

async function ownRow(db: Executor, customerId: string, id: string, lock = false): Promise<Row> {
  if (!isUuid(id)) throw errors.notFound("That brand");
  const q = db.select().from(brands).where(and(eq(brands.id, id), eq(brands.customerId, customerId))).limit(1);
  const [row] = lock ? await q.for("update") : await q;
  if (!row) throw errors.notFound("That brand");
  return row;
}

export async function getBrand(db: Db, customerId: string, id: string): Promise<BrandView> {
  const row = await ownRow(db, customerId, id);
  return (await withCounts(db, customerId, [row]))[0]!;
}

/**
 * A brand's voice, audience and guidelines as structured context for the AI tools. Only the owner can read it, and
 * nothing generates text from it yet (live generation is off); it is here so the tools can be grounded in it later.
 */
export async function brandContext(db: Db, customerId: string, id: string): Promise<BrandContext> {
  return buildBrandContext(await getBrand(db, customerId, id));
}

/** Throws unless the brand belongs to this customer. Used when attaching a brand to content. */
export async function assertOwnBrand(db: Executor, customerId: string, brandId: string | null | undefined) {
  if (!brandId) return;
  const [b] = await db.select({ id: brands.id }).from(brands).where(and(eq(brands.id, brandId), eq(brands.customerId, customerId)));
  if (!b) throw new AppError("VALIDATION_FAILED", "That brand isn't available.", { details: { field: "brandId" } });
}

/* -------------------------------------------------------------------------- */
/*  Writes                                                                    */
/* -------------------------------------------------------------------------- */

/** Serialises changes to one customer's brand list so the default rule and the limit hold under concurrent requests. */
async function lockBrands(tx: Executor, customerId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`brands:${customerId}`}, 0))`);
}

async function assertOwnImages(tx: Executor, customerId: string, ids: (string | null | undefined)[]) {
  const wanted = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!wanted.length) return;
  const own = await tx.select({ id: contentMedia.id }).from(contentMedia).where(and(eq(contentMedia.customerId, customerId), inArray(contentMedia.id, wanted)));
  if (own.length !== wanted.length) throw new AppError("VALIDATION_FAILED", "That image isn't in your media library any more.", { details: { field: "logoMediaId" } });
}

function mapError(e: unknown): never {
  const pg = pgErrorOf(e);
  if (pg?.code === "23505" && pg.constraint === "brands_name_idx") throw errors.conflict("You already have a brand with that name. Choose a different name.");
  if (pg?.code === "22P05") throw new AppError("VALIDATION_FAILED", "This text contains characters this server's database can't store yet.");
  throw e;
}

/** Creates a brand. The first brand becomes the default. */
export async function createBrand(db: Db, customerId: string, raw: unknown): Promise<BrandView> {
  const input = createInput.parse(raw);
  await limitWrites(db, customerId);
  try {
    const row = await db.transaction(async (tx) => {
      await lockBrands(tx, customerId);
      const [{ n }] = (await tx.select({ n: count() }).from(brands).where(eq(brands.customerId, customerId))) as [{ n: number }];
      if (n >= BRANDS_MAX) throw errors.conflict(`You can keep up to ${BRANDS_MAX} brands. Delete one you no longer use.`);
      await assertOwnImages(tx, customerId, [input.logoMediaId, input.coverMediaId]);
      const [created] = await tx.insert(brands).values({ ...input, customerId, isDefault: n === 0 }).returning();
      return created!;
    });
    return view(row, 0);
  } catch (e) {
    if (e instanceof AppError) throw e;
    mapError(e);
  }
}

/** Edits a brand. `expectedVersion` is the version the editor loaded; a mismatch means it changed elsewhere. */
export async function updateBrand(db: Db, customerId: string, id: string, raw: unknown): Promise<BrandView> {
  const { expectedVersion, ...changes } = updateInput.parse(raw);
  if (!Object.keys(changes).length) throw new AppError("VALIDATION_FAILED", "Nothing to change.");
  await limitWrites(db, customerId);
  try {
    const row = await db.transaction(async (tx) => {
      const current = await ownRow(tx, customerId, id, true);
      if (current.version !== expectedVersion) throw errors.conflict("This brand was changed somewhere else (another tab or device). Reload to see the latest version before editing.");
      await assertOwnImages(tx, customerId, [changes.logoMediaId, changes.coverMediaId]);
      const [u] = await tx
        .update(brands)
        .set({ ...(changes as Fields), updatedAt: new Date(), version: sql`${brands.version} + 1` })
        .where(and(eq(brands.id, id), eq(brands.customerId, customerId)))
        .returning();
      return u!;
    });
    return (await withCounts(db, customerId, [row]))[0]!;
  } catch (e) {
    if (e instanceof AppError) throw e;
    mapError(e);
  }
}

/** A copy with "(copy)" in its name. It is never the default and shares the same images. */
export async function duplicateBrand(db: Db, customerId: string, id: string): Promise<BrandView> {
  await limitWrites(db, customerId);
  try {
    const row = await db.transaction(async (tx) => {
      await lockBrands(tx, customerId);
      const src = await ownRow(tx, customerId, id);
      const [{ n }] = (await tx.select({ n: count() }).from(brands).where(eq(brands.customerId, customerId))) as [{ n: number }];
      if (n >= BRANDS_MAX) throw errors.conflict(`You can keep up to ${BRANDS_MAX} brands. Delete one you no longer use.`);
      const taken = new Set((await tx.select({ name: brands.name }).from(brands).where(eq(brands.customerId, customerId))).map((b) => b.name.toLowerCase()));
      let name = "";
      for (let i = 1; i < 100 && !name; i++) {
        const suffix = i === 1 ? " (copy)" : ` (copy ${i})`;
        const candidate = `${Array.from(src.name).slice(0, BRAND_NAME_MAX - suffix.length).join("")}${suffix}`;
        if (!taken.has(candidate.toLowerCase())) name = candidate;
      }
      if (!name) throw errors.conflict("Rename your existing copies before duplicating again.");
      const [created] = await tx
        .insert(brands)
        .values({
          customerId,
          name,
          description: src.description,
          website: src.website,
          industry: src.industry,
          logoMediaId: src.logoMediaId,
          coverMediaId: src.coverMediaId,
          primaryColor: src.primaryColor,
          secondaryColor: src.secondaryColor,
          accentColor: src.accentColor,
          personality: src.personality,
          toneOfVoice: src.toneOfVoice,
          audience: src.audience,
          demographics: src.demographics,
          platforms: src.platforms,
          keywords: src.keywords,
          hashtags: src.hashtags,
          writingGuidelines: src.writingGuidelines,
          preferredPhrases: src.preferredPhrases,
          avoidWords: src.avoidWords,
          isDefault: false,
        })
        .returning();
      return created!;
    });
    return view(row, 0);
  } catch (e) {
    if (e instanceof AppError) throw e;
    mapError(e);
  }
}

/** Makes one brand the default; the previous default (if any) stops being it in the same transaction. */
export async function setDefaultBrand(db: Db, customerId: string, id: string): Promise<void> {
  await limitWrites(db, customerId);
  await db.transaction(async (tx) => {
    await lockBrands(tx, customerId);
    await ownRow(tx, customerId, id, true);
    await tx.update(brands).set({ isDefault: false }).where(and(eq(brands.customerId, customerId), eq(brands.isDefault, true)));
    await tx.update(brands).set({ isDefault: true, updatedAt: new Date() }).where(and(eq(brands.id, id), eq(brands.customerId, customerId)));
  });
}

/**
 * Deletes a brand. Drafts and posts that used it keep all their content and simply have no brand; images stay in the
 * media library. If it was the default, the oldest remaining brand becomes the default.
 */
export async function deleteBrand(db: Db, customerId: string, id: string): Promise<{ unlinked: number }> {
  await limitWrites(db, customerId);
  return db.transaction(async (tx) => {
    await lockBrands(tx, customerId);
    const row = await ownRow(tx, customerId, id, true);
    const [{ n }] = (await tx.select({ n: count() }).from(socialPosts).where(and(eq(socialPosts.customerId, customerId), eq(socialPosts.brandId, id)))) as [{ n: number }];
    await tx.delete(brands).where(and(eq(brands.id, id), eq(brands.customerId, customerId)));
    if (row.isDefault) {
      const [next] = await tx.select({ id: brands.id }).from(brands).where(eq(brands.customerId, customerId)).orderBy(asc(brands.createdAt)).limit(1);
      if (next) await tx.update(brands).set({ isDefault: true }).where(eq(brands.id, next.id));
    }
    return { unlinked: n };
  });
}
