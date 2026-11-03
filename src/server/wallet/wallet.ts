import "server-only";
import { and, asc, count, desc, eq, gt, gte, ilike, inArray, lt, or, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import type { Executor } from "../db/client";
import { deposits, journalEntries, journalLines, ledgerAccounts } from "../db/schema";
import { walletCode } from "../ledger/accounts";

/**
 * Read-only customer wallet views, derived from the immutable ledger.
 *
 *  - available: the wallet account's balance = credits − debits on
 *    `wallet:<customer>` (a liability: money Sociotix holds for the customer).
 *  - pending: deposits submitted but not yet credited. Never part of the
 *    available balance and never spendable.
 *
 * Nothing here writes. Customers see their own lines only, with friendly
 * labels — no internal accounts, idempotency keys or staff identities.
 */

const PENDING_DEPOSIT = ["created", "awaiting_payment", "settling", "settled", "under_review"] as const;

const KIND_LABEL: Record<string, string> = {
  deposit_credit: "Deposit",
  order_debit: "Order payment",
  order_cancel: "Order cancelled — returned",
  refund: "Refund",
  reward_credit: "Referral reward",
  adjustment: "Adjustment",
  reversal: "Correction",
};

export interface WalletSummary {
  currency: "USD";
  /** Spendable balance in cents (from ledger lines). */
  availableCents: number;
  /** Submitted deposits not yet verified, in cents. Not spendable. */
  pendingCents: number;
  hasWallet: boolean;
}

export async function walletSummary(db: Executor, customerId: string): Promise<WalletSummary> {
  const [account] = await db.select({ id: ledgerAccounts.id }).from(ledgerAccounts).where(eq(ledgerAccounts.code, walletCode(customerId))).limit(1);
  const [{ credits }] = account
    ? (await db.execute<{ credits: string }>(sql`select coalesce(-sum(amount_cents), 0)::text as credits from journal_lines where account_id = ${account.id}`)).rows
    : [{ credits: "0" }];
  const [{ pending }] = (
    await db.execute<{ pending: string }>(
      sql`select coalesce(sum(amount_cents), 0)::text as pending from deposits where customer_id = ${customerId} and status in ${PENDING_DEPOSIT as unknown as string[]}`,
    )
  ).rows;
  return { currency: "USD", availableCents: Number(credits), pendingCents: Number(pending), hasWallet: Boolean(account) };
}

export interface WalletEntry {
  id: string;
  at: string;
  label: string;
  /** The ledger entry type, e.g. `order_debit`. */
  kind: string;
  /** Positive = money in, negative = money out (from the customer's point of view). */
  amountCents: number;
  /** The customer's own order reference, for order payments and returns only. */
  orderRef: string | null;
}

/** Entry types the customer can filter by, labelled as the history shows them. */
export const WALLET_KINDS = Object.keys(KIND_LABEL) as [string, ...string[]];

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Optional, read-only filters for the customer's own wallet history. */
export const walletQuery = z.object({
  kind: z.enum(WALLET_KINDS).optional(),
  direction: z.enum(["in", "out"]).optional(),
  /** Inclusive start and end days (YYYY-MM-DD, UTC). */
  from: z.string().regex(DAY).optional(),
  to: z.string().regex(DAY).optional(),
  /** Matches an entry type label, the start of an entry reference or an order reference. */
  q: z.string().trim().max(60).optional(),
  sort: z.enum(["newest", "oldest"]).optional().default("newest"),
});

const ORDER_KINDS = new Set(["order_debit", "order_cancel"]);
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function walletEntries(db: Executor, customerId: string, page = 1, pageSize = 20, raw: z.input<typeof walletQuery> = {}) {
  const f = walletQuery.parse(raw);
  const size = Math.min(Math.max(pageSize, 1), 50);
  const p = Math.min(Math.max(page, 1), 1000);
  const [account] = await db.select({ id: ledgerAccounts.id }).from(ledgerAccounts).where(eq(ledgerAccounts.code, walletCode(customerId))).limit(1);
  if (!account) return { items: [] as WalletEntry[], total: 0, page: p, pageSize: size, pages: 1, totals: { inCents: 0, outCents: 0 } };

  // Always this customer's wallet account; the filters only narrow it.
  const conds: SQL[] = [eq(journalLines.accountId, account.id)];
  if (f.kind) conds.push(eq(journalEntries.kind, f.kind));
  // Wallet is a liability: a credit (negative line) is money in for the customer.
  if (f.direction === "in") conds.push(lt(journalLines.amountCents, 0));
  if (f.direction === "out") conds.push(gt(journalLines.amountCents, 0));
  if (f.from) conds.push(gte(journalEntries.createdAt, new Date(`${f.from}T00:00:00Z`)));
  if (f.to) conds.push(lt(journalEntries.createdAt, new Date(Date.parse(`${f.to}T00:00:00Z`) + 86_400_000)));
  if (f.q) {
    const q = f.q.toLowerCase();
    const kinds = WALLET_KINDS.filter((k) => KIND_LABEL[k].toLowerCase().includes(q));
    const options: SQL[] = [and(inArray(journalEntries.kind, [...ORDER_KINDS]), ilike(journalEntries.referenceId, `%${escapeLike(f.q)}%`))!];
    if (kinds.length) options.push(inArray(journalEntries.kind, kinds));
    if (/^[0-9a-f-]{4,}$/.test(q)) options.push(sql`${journalLines.id}::text like ${`${q}%`}`);
    conds.push(or(...options)!);
  }
  const where = and(...conds);

  const [agg] = await db
    .select({
      total: count(),
      inCents: sql<string>`coalesce(-sum(${journalLines.amountCents}) filter (where ${journalLines.amountCents} < 0), 0)::text`,
      outCents: sql<string>`coalesce(sum(${journalLines.amountCents}) filter (where ${journalLines.amountCents} > 0), 0)::text`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
    .where(where);
  const rows = await db
    .select({ id: journalLines.id, at: journalEntries.createdAt, kind: journalEntries.kind, amount: journalLines.amountCents, referenceId: journalEntries.referenceId })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
    .where(where)
    .orderBy(f.sort === "oldest" ? asc(journalEntries.createdAt) : desc(journalEntries.createdAt), asc(journalLines.id))
    .limit(size)
    .offset((p - 1) * size);
  const total = Number(agg.total);
  return {
    items: rows.map((r) => ({
      id: r.id,
      at: r.at.toISOString(),
      label: KIND_LABEL[r.kind] ?? "Wallet entry",
      kind: r.kind,
      amountCents: -r.amount,
      orderRef: ORDER_KINDS.has(r.kind) ? r.referenceId : null,
    })),
    total,
    page: p,
    pageSize: size,
    pages: Math.max(1, Math.ceil(total / size)),
    /** Money in and out across every entry that matches the filters, not just this page. */
    totals: { inCents: Number(agg.inCents), outCents: Number(agg.outCents) },
  };
}

/** Pending deposits count, for summaries (read-only). */
export async function pendingDepositCount(db: Executor, customerIds: string[]) {
  if (!customerIds.length) return new Map<string, number>();
  const rows = await db
    .select({ customerId: deposits.customerId, n: count() })
    .from(deposits)
    .where(and(inArray(deposits.customerId, customerIds), inArray(deposits.status, [...PENDING_DEPOSIT])))
    .groupBy(deposits.customerId);
  return new Map(rows.map((r) => [r.customerId, r.n]));
}
