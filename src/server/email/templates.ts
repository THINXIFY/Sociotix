import "server-only";
import { getEnv } from "../env";
import type { Email } from "./index";

/**
 * Transactional email templates (EM-01). One branded, table-based layout that
 * renders in every major client, with a plain-text twin for each message.
 * Every value that came from a person (names, subjects, replies) is escaped,
 * links must be http(s), and subjects are kept to one line.
 */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** Subjects and preheaders: one line, no header injection, sensible length. */
const oneLine = (s: string, max = 140) => s.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);
/** Only absolute http(s) links make it into an email. */
const safeUrl = (url: string) => (/^https?:\/\/[^\s"'<>]+$/i.test(url) ? url : "");
const appUrl = (path: string) => `${getEnv().APP_URL}${path}`;

const C = { violet: "#7047EB", lime: "#C8FF52", graphite: "#202127", body: "#3D3F47", muted: "#6B6D76", faint: "#8A8C94", line: "#E9E9EE", tint: "#F7F5FE", page: "#F4F4F6" };
const FONT = "'Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const HEADING = "'Manrope','Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Why this email arrived: security and account mail can't be switched off; updates can. */
type Reason = "security" | "account" | "update";

interface Template {
  kind: string;
  to: string;
  subject: string;
  /** Inbox preview line. */
  preheader: string;
  eyebrow?: string;
  title: string;
  /** Plain sentences; escaped here. */
  paragraphs: string[];
  /** Key facts, e.g. order reference and service. */
  details?: [label: string, value: string][];
  /** A highlighted status pill shown with the details. */
  status?: string;
  /** Someone's own words, e.g. a support reply. */
  quote?: { from: string; text: string };
  action?: { label: string; url: string };
  /** A quieter second link under the button (e.g. "Forgot your password?"). */
  secondary?: { prompt: string; label: string; url: string };
  footnote?: string;
  reason: Reason;
}

const REASON_TEXT: Record<Reason, string> = {
  security: "You're receiving this because it concerns the security of your Sociotix account. Security emails can't be turned off.",
  account: "You're receiving this because of a change to your Sociotix account.",
  update: "You're receiving this because email updates are on for your Sociotix account.",
};

function render(t: Template): Email {
  const url = t.action ? safeUrl(t.action.url) : "";
  const p = (html: string, last = false) => `<p style="margin:0 0 ${last ? 0 : 14}px;font-family:${FONT};font-size:15px;line-height:24px;color:${C.body}">${html}</p>`;
  const paragraphs = t.paragraphs.map((s, i) => p(esc(s), i === t.paragraphs.length - 1)).join("");
  const details = t.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;background:${C.tint};border-radius:12px">
        ${t.status ? `<tr><td colspan="2" style="padding:16px 18px 4px"><span style="display:inline-block;background:${C.lime};color:${C.graphite};font-family:${FONT};font-size:12px;font-weight:700;line-height:18px;padding:3px 10px;border-radius:999px">${esc(t.status)}</span></td></tr>` : ""}
        ${t.details
          .map(
            ([k, v], i) =>
              `<tr><td style="padding:${i === 0 && !t.status ? 16 : 8}px 18px ${i === t.details!.length - 1 ? 16 : 0}px;font-family:${FONT};font-size:13px;line-height:20px;color:${C.muted};white-space:nowrap;vertical-align:top" width="1%">${esc(k)}</td><td style="padding:${i === 0 && !t.status ? 16 : 8}px 18px ${i === t.details!.length - 1 ? 16 : 0}px 0;font-family:${FONT};font-size:14px;line-height:20px;color:${C.graphite};font-weight:600;word-break:break-word">${esc(v)}</td></tr>`,
          )
          .join("")}
      </table>`
    : "";
  const quote = t.quote
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0"><tr><td style="border-left:3px solid ${C.violet};background:${C.tint};border-radius:0 12px 12px 0;padding:14px 18px">
        <p style="margin:0 0 6px;font-family:${FONT};font-size:12px;line-height:18px;font-weight:700;color:${C.violet};text-transform:uppercase;letter-spacing:.06em">${esc(t.quote.from)}</p>
        <p style="margin:0;font-family:${FONT};font-size:14px;line-height:22px;color:${C.graphite};white-space:pre-line">${esc(t.quote.text)}</p>
      </td></tr></table>`
    : "";
  const button = url
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0" class="btn"><tr><td style="border-radius:999px;background:${C.violet}">
        <a href="${esc(url)}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${esc(t.action!.label)}</a>
      </td></tr></table>
      <p style="margin:16px 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.faint};word-break:break-all">Button not working? Paste this link into your browser:<br><a href="${esc(url)}" style="color:${C.violet};text-decoration:underline">${esc(url)}</a></p>`
    : "";
  const second = t.secondary && safeUrl(t.secondary.url) ? `<p style="margin:18px 0 0;font-family:${FONT};font-size:14px;line-height:22px;color:${C.body}">${esc(t.secondary.prompt)} <a href="${esc(t.secondary.url)}" style="color:${C.violet};font-weight:600;text-decoration:underline">${esc(t.secondary.label)}</a></p>` : "";
  const footnote = t.footnote ? `<p style="margin:24px 0 0;padding:16px 0 0;border-top:1px solid ${C.line};font-family:${FONT};font-size:13px;line-height:20px;color:${C.muted}">${esc(t.footnote)}</p>` : "";
  const settings = t.reason === "update" ? ` <a href="${esc(appUrl("/dashboard/settings#notifications"))}" style="color:${C.faint};text-decoration:underline">Email settings</a> ·` : "";
  const logo = appUrl("/brand/Sociotix_Light_theme_logo.png");

  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(oneLine(t.subject))}</title>
<style>
  body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%}
  a{color:${C.violet}}
  @media (max-width:600px){
    .card{padding:28px 22px!important;border-radius:14px!important}
    .title{font-size:21px!important;line-height:28px!important}
    .btn,.btn td,.btn a{display:block!important;width:100%!important;text-align:center!important;box-sizing:border-box}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(oneLine(t.preheader, 160))}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page}">
<tr><td align="center" style="padding:32px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
  <tr><td class="card" style="background:#ffffff;border:1px solid ${C.line};border-radius:16px;padding:36px 40px">
    <a href="${esc(appUrl("/"))}" target="_blank" style="display:inline-block;text-decoration:none"><img src="${esc(logo)}" width="132" height="32" alt="Sociotix" style="display:block;border:0;outline:none;width:132px;height:32px;font-family:${HEADING};font-size:20px;font-weight:800;color:${C.graphite}"></a>
    ${t.eyebrow ? `<p style="margin:32px 0 8px;font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${C.violet}">${esc(t.eyebrow)}</p>` : `<div style="height:32px;line-height:32px;font-size:0">&nbsp;</div>`}
    <h1 class="title" style="margin:0 0 14px;font-family:${HEADING};font-size:24px;line-height:32px;font-weight:800;letter-spacing:-.01em;color:${C.graphite}">${esc(t.title)}</h1>
    ${paragraphs}${details}${quote}${button}${second}${footnote}
  </td></tr>
  <tr><td style="padding:22px 28px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.faint};text-align:center">
    ${esc(REASON_TEXT[t.reason])}<br>
    <a href="${esc(appUrl("/help"))}" style="color:${C.faint};text-decoration:underline">Help Center</a> ·${settings} <a href="${esc(appUrl("/dashboard/support"))}" style="color:${C.faint};text-decoration:underline">Contact support</a><br>
    <span style="color:#B3B4BA">Sociotix · Smarter social media growth</span>
  </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    t.title,
    ...t.paragraphs,
    ...(t.status ? [`Status: ${t.status}`] : []),
    ...(t.details?.length ? [t.details.map(([k, v]) => `${k}: ${v}`).join("\n")] : []),
    ...(t.quote ? [`${t.quote.from}:\n${t.quote.text}`] : []),
    ...(url ? [`${t.action!.label}: ${url}`] : []),
    ...(t.secondary && safeUrl(t.secondary.url) ? [`${t.secondary.prompt} ${t.secondary.label}: ${t.secondary.url}`] : []),
    ...(t.footnote ? [t.footnote] : []),
    `—\n${REASON_TEXT[t.reason]}\nHelp Center: ${appUrl("/help")}`,
  ].join("\n\n");

  return { kind: t.kind, to: t.to, subject: oneLine(t.subject), html, text };
}

/* -------------------------------------------------------------------------- */
/*  Account and security                                                      */
/* -------------------------------------------------------------------------- */

export function verifyEmailMessage(to: string, name: string, url: string): Email {
  return render({
    kind: "verify_email",
    to,
    reason: "account",
    subject: "Confirm your email for Sociotix",
    preheader: "One click to finish creating your account.",
    eyebrow: "Almost there",
    title: `Welcome, ${name}`,
    paragraphs: ["Confirm your email address to finish creating your Sociotix account. It takes one click."],
    action: { label: "Confirm email", url },
    footnote: "This link expires in 24 hours. If you didn't create an account, you can ignore this email.",
  });
}

export function welcomeMessage(to: string, name: string): Email {
  return render({
    kind: "welcome",
    to,
    reason: "account",
    subject: "Welcome to Sociotix",
    preheader: "Your account is ready. Here's where to start.",
    eyebrow: "You're in",
    title: `Welcome to Sociotix, ${name}`,
    paragraphs: ["Your email is confirmed and your account is ready.", "Start by telling us your goals on the dashboard. We'll suggest services and tools that fit, and you can browse every service while ordering opens."],
    action: { label: "Open your dashboard", url: appUrl("/dashboard") },
    footnote: "Questions? Reply through the Support Center and our team will help.",
  });
}

export function existingAccountMessage(to: string, loginUrl: string, resetUrl: string): Email {
  return render({
    kind: "existing_account",
    to,
    reason: "security",
    subject: "You already have a Sociotix account",
    preheader: "Someone tried to register with this email.",
    title: "You already have an account",
    paragraphs: ["Someone just tried to create a Sociotix account with this email. If that was you, sign in instead."],
    action: { label: "Sign in", url: loginUrl },
    secondary: { prompt: "Forgot your password?", label: "Reset it", url: resetUrl },
    footnote: "If it wasn't you, no action is needed. Your account hasn't changed.",
  });
}

export function resetPasswordMessage(to: string, url: string): Email {
  return render({
    kind: "reset_password",
    to,
    reason: "security",
    subject: "Reset your Sociotix password",
    preheader: "Choose a new password. This link expires in 1 hour.",
    eyebrow: "Password reset",
    title: "Reset your password",
    paragraphs: ["Use the button below to choose a new password. For your security, you'll be signed out on every device."],
    details: [["Link expires", "In 1 hour"], ["Can be used", "Once"]],
    action: { label: "Choose a new password", url },
    footnote: "If you didn't ask for this, ignore this email. Your password won't change.",
  });
}

export function passwordChangedMessage(to: string): Email {
  return render({
    kind: "password_changed",
    to,
    reason: "security",
    subject: "Your Sociotix password was changed",
    preheader: "If this was you, no action is needed.",
    eyebrow: "Security",
    title: "Your password was changed",
    paragraphs: ["The password for your Sociotix account was just changed, and your other sessions were signed out.", "If this was you, there's nothing else to do."],
    action: { label: "Review account security", url: appUrl("/dashboard/security") },
    footnote: "If this wasn't you, reset your password right away and contact support.",
  });
}

export function staffSetupMessage(to: string, name: string, role: string, url: string, hours: number): Email {
  return render({
    kind: "staff_setup",
    to,
    reason: "account",
    subject: `Set up your Sociotix ${role} access`,
    preheader: "Set a password and an authenticator app to finish.",
    eyebrow: "Admin access",
    title: `Hi ${name}`,
    paragraphs: [`You've been given ${role} access to the Sociotix admin panel. Set a password and an authenticator app to finish.`],
    details: [["Role", role], ["Link expires", `In ${hours} hours`]],
    action: { label: "Set up access", url },
    footnote: "This link works once. If you weren't expecting it, ignore this email.",
  });
}

export function recoveryCodeUsedMessage(to: string, remaining: number): Email {
  return render({
    kind: "recovery_code_used",
    to,
    reason: "security",
    subject: "A Sociotix recovery code was used",
    preheader: `${remaining} recovery codes left.`,
    eyebrow: "Security",
    title: "A recovery code was used",
    paragraphs: ["A one-time recovery code was just used to sign in to the Sociotix admin panel."],
    details: [["Codes remaining", String(remaining)]],
    footnote: "If this wasn't you, contact the platform owner immediately.",
  });
}

/* -------------------------------------------------------------------------- */
/*  Support                                                                   */
/* -------------------------------------------------------------------------- */

interface TicketRef {
  reference: string;
  subject: string;
}
const ticketUrl = (ref: string) => appUrl(`/dashboard/support?ticket=${encodeURIComponent(ref)}`);

export function ticketCreatedMessage(to: string, t: TicketRef): Email {
  return render({
    kind: "ticket_created",
    to,
    reason: "update",
    subject: `We've got your request: ${t.subject}`,
    preheader: "Our team will reply in the Support Center.",
    eyebrow: "Support",
    title: "We've got your request",
    paragraphs: ["Thanks for getting in touch. Your ticket is with our support team, and we'll reply in the Support Center. You'll get an email when we do."],
    details: [["Ticket", t.reference], ["Subject", t.subject]],
    action: { label: "View your ticket", url: ticketUrl(t.reference) },
  });
}

export function ticketReplyMessage(to: string, t: TicketRef, reply: string, resolved: boolean): Email {
  const excerpt = reply.length > 600 ? `${reply.slice(0, 600).trimEnd()}…` : reply;
  return render({
    kind: "ticket_reply",
    to,
    reason: "update",
    subject: resolved ? `Resolved: ${t.subject}` : `New reply: ${t.subject}`,
    preheader: oneLine(excerpt, 120),
    eyebrow: "Support",
    title: resolved ? "We've resolved your request" : "Our team replied",
    paragraphs: [resolved ? "Here's our latest reply. If anything still isn't right, reply in the Support Center and the ticket reopens." : "Here's the latest reply on your ticket."],
    quote: { from: "Sociotix Support", text: excerpt },
    details: [["Ticket", t.reference], ["Subject", t.subject]],
    action: { label: resolved ? "View ticket" : "Reply in the Support Center", url: ticketUrl(t.reference) },
    footnote: "For your security, we'll never ask for passwords, codes or card numbers.",
  });
}

export function ticketStatusMessage(to: string, t: TicketRef, status: string, explain: string): Email {
  return render({
    kind: "ticket_status",
    to,
    reason: "update",
    subject: `Ticket update: ${t.subject}`,
    preheader: `Status: ${status}. ${explain}`,
    eyebrow: "Support",
    title: "Your ticket was updated",
    paragraphs: [explain],
    status,
    details: [["Ticket", t.reference], ["Subject", t.subject]],
    action: { label: "View your ticket", url: ticketUrl(t.reference) },
  });
}

/* -------------------------------------------------------------------------- */
/*  Orders                                                                    */
/* -------------------------------------------------------------------------- */

export const ORDER_EMAILS = {
  "order.accepted": { status: "Accepted", title: "Your order was accepted", subject: "Order accepted", line: "passed review and is queued to start." },
  "order.needs_info": { status: "Action needed", title: "Your order needs a detail from you", subject: "Action needed on your order", line: "is paused until you update it." },
  "order.fulfillment_started": { status: "In progress", title: "Your order is in progress", subject: "Order in progress", line: "has started." },
  "order.completed": { status: "Completed", title: "Your order is complete", subject: "Order completed", line: "has been delivered." },
  "order.rejected": { status: "Not accepted", title: "Your order wasn't accepted", subject: "Order not accepted", line: "couldn't be accepted. The amount was returned to your wallet." },
  "order.cancelled": { status: "Cancelled", title: "Your order was cancelled", subject: "Order cancelled", line: "was cancelled. The amount was returned to your wallet." },
  "order.failed": { status: "Couldn't be completed", title: "Your order couldn't be completed", subject: "Order couldn't be completed", line: "couldn't be completed." },
} as const;
export type OrderEmailKind = keyof typeof ORDER_EMAILS;

export function orderUpdateMessage(to: string, notice: OrderEmailKind, o: { reference: string; service: string; message?: string }): Email {
  const m = ORDER_EMAILS[notice];
  return render({
    kind: notice.replace(".", "_"),
    to,
    reason: "update",
    subject: `${m.subject} · ${o.reference}`,
    preheader: `${o.service} ${m.line}`,
    eyebrow: "Order update",
    title: m.title,
    paragraphs: [`${o.service} ${m.line}`],
    quote: o.message ? { from: "Note from our team", text: o.message } : undefined,
    status: m.status,
    details: [["Order", o.reference], ["Service", o.service]],
    action: { label: notice === "order.needs_info" ? "Update your order" : "View order", url: appUrl(`/dashboard/orders?order=${encodeURIComponent(o.reference)}`) },
  });
}
