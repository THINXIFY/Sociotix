import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import type { Email } from "@/server/email";
import {
  existingAccountMessage,
  orderUpdateMessage,
  passwordChangedMessage,
  recoveryCodeUsedMessage,
  resetPasswordMessage,
  staffSetupMessage,
  ticketCreatedMessage,
  ticketReplyMessage,
  ticketStatusMessage,
  verifyEmailMessage,
  welcomeMessage,
} from "@/server/email/templates";
import { getEnv } from "@/server/env";

export const metadata: Metadata = { title: "Email previews", robots: { index: false, follow: false } };

/* Development only: every transactional template rendered with sample data. Nothing is sent or captured. */

/* Sample data only — never a real customer, address, ticket, order or token. "long" and "tricky" check wrapping and escaping. */
const DATA = {
  typical: {
    name: "Maya",
    ticket: { reference: "TCK-7K2M9Q4D", subject: "Order hasn't started yet" },
    order: { reference: "ORD-5F1A9C27E0", service: "Instagram Followers · 1,000" },
    reply: "Thanks for your patience! We checked the profile link and the order is ready to start. You'll see progress on the order page shortly.",
    note: "Please make the profile public so we can start.",
  },
  long: {
    name: "Maximiliana-Alexandrina",
    ticket: { reference: "TCK-0000LONG", subject: "Question about a large multi-platform campaign across Instagram, TikTok and YouTube for our product launch next month" },
    order: { reference: "ORD-LONGLONG01", service: "YouTube Watch Time · 4,000 hours for a long-form documentary channel" },
    reply: `${"We've reviewed every item in your request in detail. ".repeat(14)}\n\nNew paragraph: thanks again for the clear brief.`,
    note: "The target link points to a private playlist. Please make the playlist public, or send a link to an individual public video, so delivery can begin.",
  },
  tricky: {
    name: "Zoë <b>O'Brien</b> & Co",
    ticket: { reference: "TCK-ESC4PE01", subject: '<script>alert("x")</script> "Quotes" & ampersands' },
    order: { reference: "ORD-ESC4PE0001", service: "Followers <img src=x onerror=alert(1)>" },
    reply: "Here's a <a href=\"javascript:alert(1)\">link</a> & some <i>markup</i> that must show as plain text.",
    note: "Line one\nLine two with <tags> & 'quotes'",
  },
} as const;
type DataSet = keyof typeof DATA;
const TO = "maya@example.com";

function previews(base: string, set: DataSet): { group: string; items: [string, Email][] }[] {
  const { name, ticket, order, reply, note } = DATA[set];
  return [
    {
      group: "Account",
      items: [
        ["Email verification", verifyEmailMessage(TO, name, `${base}/verify-email?token=sample-token-not-valid`)],
        ["Welcome", welcomeMessage(TO, name)],
        ["Already registered", existingAccountMessage(TO, `${base}/login`, `${base}/forgot-password`)],
      ],
    },
    {
      group: "Security",
      items: [
        ["Password reset", resetPasswordMessage(TO, `${base}/reset-password?token=sample-token-not-valid`)],
        ["Password changed", passwordChangedMessage(TO)],
        ["Staff setup", staffSetupMessage(TO, name, "Support Agent", `${base}/admin/setup?token=sample-token-not-valid`, 72)],
        ["Recovery code used", recoveryCodeUsedMessage(TO, 7)],
      ],
    },
    {
      group: "Support",
      items: [
        ["Ticket created", ticketCreatedMessage(TO, ticket)],
        ["Staff reply", ticketReplyMessage(TO, ticket, reply, false)],
        ["Resolved", ticketReplyMessage(TO, ticket, "All sorted: your order started this morning.", true)],
        ["Status update", ticketStatusMessage(TO, ticket, "In progress", "Our team is working on it.")],
      ],
    },
    {
      group: "Orders",
      items: [
        ["Accepted", orderUpdateMessage(TO, "order.accepted", order)],
        ["Needs a detail", orderUpdateMessage(TO, "order.needs_info", { ...order, message: note })],
        ["In progress", orderUpdateMessage(TO, "order.fulfillment_started", order)],
        ["Completed", orderUpdateMessage(TO, "order.completed", order)],
        ["Cancelled", orderUpdateMessage(TO, "order.cancelled", { ...order, message: "Cancelled at your request." })],
        ["Couldn't be completed", orderUpdateMessage(TO, "order.failed", { ...order, message: "The account was set to private during delivery." })],
      ],
    },
  ];
}

type Params = { t?: string; view?: string; data?: string };

async function Previews({ searchParams }: { searchParams: Promise<Params> }) {
  await connection();
  let env;
  try {
    env = getEnv();
  } catch {
    notFound();
  }
  if (env.APP_ENV !== "development") notFound();
  const { t, view, data } = await searchParams;
  const set: DataSet = data === "long" || data === "tricky" ? data : "typical";
  const groups = previews(env.APP_URL, set);
  const q = (p: Params) => `?${new URLSearchParams({ t: p.t ?? email.kind, view: p.view ?? view ?? "desktop", data: p.data ?? set })}`;
  const all = groups.flatMap((g) => g.items);
  const [label, email] = all.find(([, e]) => e.kind === t) ?? all[0];
  const tab = (v: string, text: string) => (
    <Link href={q({ view: v })} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${(view ?? "desktop") === v ? "bg-foreground text-background" : "border bg-card"}`}>
      {text}
    </Link>
  );
  return (
    <main className="mx-auto grid max-w-[90rem] gap-6 px-4 py-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav aria-label="Templates">
        <p className="text-xs font-bold tracking-wider text-soon uppercase">Development only · never sent</p>
        <h1 className="mt-1 font-heading text-2xl font-extrabold">Email previews</h1>
        {groups.map((g) => (
          <div key={g.group} className="mt-5">
            <p className="text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{g.group}</p>
            <ul className="mt-1.5 space-y-0.5">
              {g.items.map(([name, e]) => (
                <li key={e.kind}>
                  <Link href={q({ t: e.kind })} aria-current={e.kind === email.kind ? "page" : undefined} className={`block rounded-lg px-2.5 py-1.5 text-sm ${e.kind === email.kind ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted"}`}>
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <section aria-label={`${label} preview`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{email.subject}</p>
            <p className="text-xs text-muted-foreground">
              To {email.to} · kind <code>{email.kind}</code>
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["typical", "long", "tricky"] as const).map((d) => (
              <Link key={d} href={q({ data: d })} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${set === d ? "bg-primary text-primary-foreground" : "border bg-card"}`}>
                {d === "typical" ? "Typical data" : d === "long" ? "Long content" : "Special characters"}
              </Link>
            ))}
            <span className="mx-1 w-px bg-border" aria-hidden />
            {tab("desktop", "Desktop")}
            {tab("mobile", "Mobile")}
            {tab("text", "Plain text")}
          </div>
        </div>
        {view === "text" ? (
          <pre className="mt-4 overflow-auto rounded-2xl border bg-card p-5 text-sm leading-relaxed whitespace-pre-wrap">{email.text}</pre>
        ) : (
          <div className="mt-4 flex justify-center rounded-2xl border bg-muted/40 p-4">
            <iframe title={`${label} email`} srcDoc={email.html} sandbox="" className="h-[52rem] rounded-xl border bg-white" style={{ width: view === "mobile" ? 375 : "100%", maxWidth: 720 }} />
          </div>
        )}
      </section>
    </main>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<Params> }) {
  return (
    <Suspense fallback={null}>
      <Previews searchParams={searchParams} />
    </Suspense>
  );
}
