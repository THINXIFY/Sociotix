/**
 * Global search (GS-01): one ranked index over content customers can already
 * reach — the public service catalog, the public AI tools, their own dashboard
 * pages and the public Help Center. Nothing private or admin-only is indexed,
 * and nothing here reads anyone's records.
 */

import { AI_TOOLS, aiToolHref, type AiAvailability } from "./ai/registry";
import { CATEGORY_META, matchesQuery, PLATFORM_BY_ID, SERVICES, type Service, STATUS_META } from "./catalog";
import { HELP_ARTICLES } from "./help/articles";

export type SearchGroup = "services" | "tools" | "pages" | "help";

export interface SearchItem {
  id: string;
  group: SearchGroup;
  title: string;
  description: string;
  /** Small label, e.g. "Instagram · Followers" or "Coming soon". */
  meta: string;
  /** Honest availability: shown as a pill when the thing isn't fully open yet. */
  badge?: string;
  href: string;
  /** Extra words that should find this item. */
  keywords: string;
  /** For services: preselected on New Order. */
  service?: Service;
  /** For AI tools and pages: an icon key the dialog maps to an icon. */
  icon?: string;
}

export const GROUP_LABEL: Record<SearchGroup, string> = { services: "SMM services", tools: "AI tools", pages: "Dashboard pages", help: "Help & support" };
export const GROUP_ORDER: SearchGroup[] = ["services", "tools", "pages", "help"];

const AI_BADGE: Record<AiAvailability, string | undefined> = { available: undefined, coming_soon: "Coming soon", unavailable: "Unavailable" };

/** The customer's own dashboard pages. Admin areas are never listed. */
const PAGES: Omit<SearchItem, "group">[] = [
  { id: "page:overview", title: "Overview", description: "Your dashboard home: balance, orders and next steps.", meta: "Dashboard", href: "/dashboard", keywords: "home dashboard start balance", icon: "overview" },
  { id: "page:new-order", title: "New Order", description: "Choose a service and set up an order.", meta: "Ordering", href: "/dashboard/new-order", keywords: "order buy place purchase checkout", icon: "new-order" },
  { id: "page:finder", title: "Service Finder", description: "Answer a few questions and get matching services.", meta: "Ordering", href: "/dashboard/service-finder", keywords: "find recommend suggest goal help choose", icon: "finder" },
  { id: "page:orders", title: "My Orders", description: "Every order and its progress.", meta: "Ordering", href: "/dashboard/orders", keywords: "orders status track progress history", icon: "orders" },
  { id: "page:add-funds", title: "Add Funds", description: "Top up your wallet balance.", meta: "Wallet", href: "/dashboard/add-funds", keywords: "deposit top up wallet balance money pay", icon: "add-funds" },
  { id: "page:transactions", title: "Transactions", description: "Your wallet history.", meta: "Wallet", href: "/dashboard/transactions", keywords: "wallet history payments ledger statement", icon: "transactions" },
  { id: "page:notifications", title: "Notifications", description: "Order updates, support replies and security alerts.", meta: "Account", href: "/dashboard/notifications", keywords: "alerts updates inbox bell", icon: "notifications" },
  { id: "page:support", title: "Support Center", description: "Open a ticket or reply to our team.", meta: "Help", href: "/dashboard/support", keywords: "help ticket contact question problem", icon: "support" },
  { id: "page:digital", title: "My Digital Products", description: "Your library of templates and toolkits.", meta: "Library", href: "/dashboard/digital-products", keywords: "library downloads templates toolkits ebooks", icon: "digital" },
  { id: "page:ai", title: "AI workspace", description: "Your Sociotix AI home.", meta: "Sociotix AI", href: "/dashboard/ai", keywords: "ai assistant workspace tools", icon: "ai" },
  { id: "page:social", title: "Social workspace", description: "Drafts, campaigns and your posting calendar.", meta: "Social", href: "/dashboard/social", keywords: "social posts drafts publishing accounts", icon: "social" },
  { id: "page:calendar", title: "Content calendar", description: "Arrange drafts by date.", meta: "Social", href: "/dashboard/social/calendar", keywords: "calendar schedule plan posts", icon: "calendar" },
  { id: "page:referrals", title: "Referrals & Rewards", description: "Invite friends and track rewards.", meta: "Account", href: "/dashboard/referrals", keywords: "refer invite friends rewards affiliate", icon: "referrals" },
  { id: "page:settings", title: "Settings", description: "Language, currency, notifications and your goals.", meta: "Account", href: "/dashboard/settings", keywords: "preferences language currency theme notifications goals platforms", icon: "settings" },
  { id: "page:security", title: "Security", description: "Password and signed-in devices.", meta: "Account", href: "/dashboard/security", keywords: "password sessions devices sign out login", icon: "security" },
  { id: "page:profile", title: "My Profile", description: "Your name, contact and business details.", meta: "Account", href: "/dashboard/profile", keywords: "profile name account business details", icon: "profile" },
];

const SERVICE_ITEMS: SearchItem[] = SERVICES.map((s) => {
  const p = PLATFORM_BY_ID[s.platformId];
  return {
    id: `service:${s.id}`,
    group: "services",
    title: s.name,
    description: s.description,
    meta: `${p?.short ?? s.platformId} · ${CATEGORY_META[s.category].label}`,
    badge: s.status === "active" ? undefined : STATUS_META[s.status].label,
    href: `/dashboard/new-order?service=${encodeURIComponent(s.id)}`,
    keywords: "",
    service: s,
  };
});

const TOOL_ITEMS: SearchItem[] = AI_TOOLS.map((t) => ({
  id: `tool:${t.id}`,
  group: "tools",
  title: t.name,
  description: t.tagline,
  meta: "Sociotix AI",
  badge: AI_BADGE[t.availability],
  href: aiToolHref(t),
  keywords: `${t.description} ai`,
  icon: t.icon,
}));

const HELP_ITEMS: SearchItem[] = [
  { id: "help:center", group: "help", title: "Help Center", description: "Guides and answers about Sociotix.", meta: "Help", href: "/help", keywords: "help guides faq docs", icon: "help" },
  ...HELP_ARTICLES.map((a) => ({ id: `help:${a.slug}`, group: "help" as const, title: a.title, description: a.answer, meta: "Help article", href: `/help/${a.slug}`, keywords: a.category.replace(/-/g, " "), icon: "help" })),
];

const PAGE_ITEMS: SearchItem[] = PAGES.map((p) => ({ ...p, group: "pages" }));

const words = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(Boolean);
export const queryTerms = (q: string) => words(q).slice(0, 6);

/** Higher is better; 0 means no match. Every term must match somewhere. */
function score(item: SearchItem, terms: string[], q: string): number {
  if (!terms.length) return 0;
  const title = item.title.toLowerCase();
  const titleWords = words(item.title);
  const metaWords = words(`${item.meta} ${item.keywords}`);
  const descWords = words(item.description);
  let total = 0;
  for (const t of terms) {
    if (titleWords.some((w) => w === t)) total += 6;
    else if (titleWords.some((w) => w.startsWith(t))) total += 4;
    else if (metaWords.some((w) => w.startsWith(t))) total += 2;
    else if (descWords.some((w) => w.startsWith(t))) total += 1;
    else if (item.service && matchesQuery(item.service, t)) total += 2; // catalog synonyms, e.g. "ig" → Instagram
    else return 0;
  }
  if (title.startsWith(q.trim().toLowerCase())) total += 5;
  if (item.service?.featured) total += 0.5;
  return total;
}

const LIMIT: Record<SearchGroup, number> = { services: 6, tools: 4, pages: 4, help: 4 };
const ALL: SearchItem[] = [...SERVICE_ITEMS, ...TOOL_ITEMS, ...PAGE_ITEMS, ...HELP_ITEMS];

/** Ranked results per group, plus how many matched in total for each. */
export function globalSearch(query: string) {
  const terms = queryTerms(query);
  const groups = GROUP_ORDER.map((group) => {
    const ranked = ALL.filter((i) => i.group === group)
      .map((i) => ({ i, s: score(i, terms, query) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s || a.i.title.localeCompare(b.i.title));
    return { group, total: ranked.length, items: ranked.slice(0, LIMIT[group]).map((r) => r.i) };
  }).filter((g) => g.items.length);
  return { terms, groups };
}

/** Shown before typing: the most useful starting points. */
export const QUICK_LINKS: SearchItem[] = ["page:new-order", "page:finder", "page:orders", "page:ai", "page:support"].map((id) => PAGE_ITEMS.find((p) => p.id === id)!);

/** Splits text into plain and matched parts for highlighting (prefix matches on word starts). */
export function highlightParts(text: string, terms: string[]): { text: string; match: boolean }[] {
  if (!terms.length) return [{ text, match: false }];
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length);
  const re = new RegExp(`(?<![a-z0-9])(${escaped.join("|")})`, "gi");
  const out: { text: string; match: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index), match: false });
    out.push({ text: m[0], match: true });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), match: false });
  return out;
}
