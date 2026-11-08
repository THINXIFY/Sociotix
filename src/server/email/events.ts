import "server-only";
import { and, eq } from "drizzle-orm";
import type { NotificationPref } from "@/lib/account";
import type { Executor } from "../db/client";
import { notificationPreferences, users } from "../db/schema";
import { getEnv } from "../env";
import { logger } from "../log";
import { emailConfigured, type Email, sendEmail } from "./index";

/**
 * Optional update emails (EM-01): welcome, support and order updates. Separate
 * from in-app notifications and from security mail, which always sends.
 *
 * Callers queue an email inside their transaction only when the underlying
 * event is new (the in-app notification was actually inserted, the ticket was
 * actually created), then flush after commit — so a rolled-back or retried
 * action never emails, and a delivery failure never undoes the action.
 */

/** `pref` is the customer's email setting that governs this message; null for account mail like the welcome. */
export type Outbox = { userId: string; pref: NotificationPref | null; build: (to: string, name: string) => Email }[];

/** Off unless EMAIL_NOTIFICATIONS=true and a transport is configured. */
export const updateEmailsEnabled = () => getEnv().EMAIL_NOTIFICATIONS && emailConfigured();

export async function flushOutbox(db: Executor, outbox: Outbox) {
  if (!outbox.length || !updateEmailsEnabled()) return;
  for (const item of outbox) {
    try {
      const [u] = await db.select({ email: users.email, name: users.name, verified: users.emailVerifiedAt, status: users.status }).from(users).where(eq(users.id, item.userId)).limit(1);
      // Only confirmed, active addresses get updates.
      if (!u?.verified || u.status !== "active") continue;
      const [pref] = item.pref
        ? await db
            .select({ enabled: notificationPreferences.enabled })
            .from(notificationPreferences)
            .where(and(eq(notificationPreferences.userId, item.userId), eq(notificationPreferences.kind, item.pref), eq(notificationPreferences.channel, "email")))
            .limit(1)
        : [];
      if (pref && !pref.enabled) continue;
      await sendEmail(item.build(u.email, u.name.split(" ")[0] || "there"));
    } catch (err) {
      // The action already succeeded; a mail problem is logged (without the address) and never surfaced to the user.
      logger().error({ err, pref: item.pref }, "update email not delivered");
    }
  }
}
