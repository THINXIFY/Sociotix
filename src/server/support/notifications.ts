import "server-only";
import { and, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { NotificationItem, NotificationKind, NotificationPage } from "@/lib/notifications";
import type { Executor } from "../db/client";
import { notifications } from "../db/schema";
import { NOTIFICATION_KIND } from "../db/schema/enums";

/* In-app notifications for the signed-in user (5G-A, NT-01). Real persisted rows only; nothing is emailed. */

/**
 * Records one notification for a real event, inside the caller's transaction.
 * The dedupe key names the event, so a retried or replayed event never notifies twice.
 */
export async function notifyUser(tx: Executor, n: { userId: string; kind: NotificationKind; title: string; body?: string | null; link?: string | null; dedupeKey: string }) {
  await tx
    .insert(notifications)
    .values({ recipientUserId: n.userId, kind: n.kind, title: n.title.slice(0, 160), body: n.body ? n.body.slice(0, 200) : null, link: n.link ?? null, dedupeKey: n.dedupeKey })
    .onConflictDoNothing({ target: [notifications.recipientUserId, notifications.dedupeKey] });
}

const PAGE = 20;
const CURSOR = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\|([0-9a-f-]{36})$/;

export const listQuerySchema = z.strictObject({
  status: z.enum(["all", "unread"]).optional().default("all"),
  kind: z.enum(NOTIFICATION_KIND).optional(),
  q: z.string().trim().max(80).optional().default(""),
  before: z.string().regex(CURSOR).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(PAGE),
});

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** The user's own notifications, newest first, a page at a time (keyset pagination on time + id). */
export async function listNotifications(db: Executor, userId: string, raw: z.input<typeof listQuerySchema> = {}): Promise<NotificationPage> {
  const q = listQuerySchema.parse(raw);
  const mine = eq(notifications.recipientUserId, userId);
  const conds: SQL[] = [mine];
  if (q.status === "unread") conds.push(isNull(notifications.readAt));
  if (q.kind) conds.push(eq(notifications.kind, q.kind));
  for (const term of q.q.split(/\s+/).filter(Boolean).slice(0, 5)) {
    const p = `%${likeEscape(term)}%`;
    conds.push(or(ilike(notifications.title, p), ilike(notifications.body, p))!);
  }
  if (q.before) {
    const [, at, id] = CURSOR.exec(q.before)!;
    conds.push(sql`(${notifications.createdAt}, ${notifications.id}) < (${new Date(at)}, ${id}::uuid)`);
  }
  const [rows, [{ unread }]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(and(...conds))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(q.limit + 1),
    db.select({ unread: count() }).from(notifications).where(and(mine, isNull(notifications.readAt))),
  ]);
  const page = rows.slice(0, q.limit);
  const last = page.at(-1);
  return {
    unread,
    items: page.map((n): NotificationItem => ({ id: n.id, kind: n.kind as NotificationKind, title: n.title, body: n.body, link: n.link, read: Boolean(n.readAt), at: n.createdAt.toISOString() })),
    next: rows.length > q.limit && last ? `${last.createdAt.toISOString()}|${last.id}` : null,
  };
}

export const markReadSchema = z.strictObject({ ids: z.array(z.string().uuid()).max(50).optional(), all: z.boolean().optional(), read: z.boolean().optional().default(true) });

/** Marks the user's own notifications read (or unread again); ids belonging to someone else are simply not matched. */
export async function markRead(db: Executor, userId: string, raw: unknown) {
  const { ids, all, read } = markReadSchema.parse(raw);
  const mine = eq(notifications.recipientUserId, userId);
  if (all && read) await db.update(notifications).set({ readAt: new Date() }).where(and(mine, isNull(notifications.readAt)));
  else if (ids?.length)
    await db
      .update(notifications)
      .set({ readAt: read ? new Date() : null })
      .where(and(mine, inArray(notifications.id, ids), read ? isNull(notifications.readAt) : isNotNull(notifications.readAt)));
}
