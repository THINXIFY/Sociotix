"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Accordion } from "@base-ui/react/accordion";
import { NavigationMenu } from "@base-ui/react/navigation-menu";
import { motion } from "motion/react";
import { ArrowRight, ChevronDown, LayoutGrid, Lock, type LucideIcon, Share2, Sparkles, Store, Wand2, Workflow } from "lucide-react";
import { popupSurface } from "@/components/ui/menu";
import { CATALOG_TOTALS } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/*
 * "More Solutions": the header's existing top-level item, as a compact two-column dropdown on
 * desktop and a grouped accordion in the phone menu. One list feeds both. Workspace links follow
 * the normal sign-in redirect for guests (and return to the page afterwards).
 */

/** `hint` is the one-line status shown at the bottom of the dropdown while an item is highlighted. `account` items need a customer sign-in. */
type Solution = { label: string; description: string; href: string; icon: LucideIcon; hint?: string; account?: boolean };

export const SOLUTION_GROUPS: { title: string; items: Solution[] }[] = [
  {
    title: "Explore Solutions",
    items: [
      { label: "SMM Marketplace", description: "Services for every major platform", href: "/#services", icon: Store, hint: `Browse ${CATALOG_TOTALS.services} services across ${CATALOG_TOTALS.platforms} platforms` },
      { label: "AI Tools", description: "Plan and write social content", href: "/ai-tools", icon: Sparkles, hint: "Free tool pages and guides · generation opens at launch" },
      { label: "Social Management", description: "Manage your social presence", href: "/social-management", icon: Share2, hint: "See everything the social workspace includes" },
    ],
  },
  {
    title: "Your Workspace",
    items: [
      { label: "Social Workspace", description: "Accounts, content and campaigns", href: "/dashboard/social", icon: LayoutGrid, account: true },
      { label: "AI Workspace", description: "Your AI tools and usage", href: "/dashboard/ai", icon: Wand2, account: true },
      { label: "Automations", description: "Reminders, checklists and reviews", href: "/dashboard/social/automations", icon: Workflow, account: true },
    ],
  },
];

const ALL = SOLUTION_GROUPS.flatMap((g) => g.items);

/** Section links (with #) point into a page, so they're never "the current page". The most specific match wins. */
function useCurrentHref() {
  const pathname = usePathname() ?? "/";
  const matches = ALL.filter((s) => !s.href.includes("#") && (pathname === s.href || pathname.startsWith(`${s.href}/`)));
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

const iconClass = "size-4 shrink-0 text-muted-foreground transition-colors duration-150 group-hover/item:text-primary group-focus-visible/item:text-primary group-aria-[current=page]/item:text-primary";

/**
 * Desktop: the "More Solutions" trigger and its dropdown, inside the header's NavigationMenu list.
 * One soft highlight glides to whichever row is hovered or focused (across both columns), the row's
 * icon tile fills, an arrow slides in, and the footer line says what that destination offers.
 */
export function SolutionsMenuItem({ highlighted, signedIn = false }: { highlighted?: boolean; signedIn?: boolean }) {
  const current = useCurrentHref();
  const [active, setActive] = React.useState<string | null>(null);
  const activeItem = ALL.find((s) => s.href === active) ?? null;
  const hint = !activeItem
    ? "Smarter Social. Bigger Impact."
    : activeItem.account
      ? signedIn
        ? `Opens ${activeItem.label} in your dashboard`
        : "Sign in first, then you go straight there"
      : (activeItem.hint ?? activeItem.description);
  return (
    <NavigationMenu.Item value="solutions">
      <NavigationMenu.Trigger
        className={cn(
          "group relative inline-flex items-center gap-1 rounded-full px-2 py-2 text-sm font-medium whitespace-nowrap outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/40 data-popup-open:text-foreground xl:px-3",
          highlighted || current ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        More Solutions
        <NavigationMenu.Icon className="flex">
          <ChevronDown className="size-3.5 transition-transform duration-150 group-data-popup-open:rotate-180 motion-reduce:transition-none" aria-hidden />
        </NavigationMenu.Icon>
      </NavigationMenu.Trigger>
      <NavigationMenu.Content className="w-[min(40rem,calc(100vw-2rem))] p-2" onPointerLeave={() => setActive(null)}>
        <div className="grid grid-cols-2 divide-x divide-border/70 dark:divide-white/10">
          {SOLUTION_GROUPS.map((g) => (
            <div key={g.title} className="min-w-0 px-1.5 first:ps-0 last:pe-0">
              <p className="px-2.5 pt-1.5 pb-1.5 text-[0.7rem] font-medium text-muted-foreground">{g.title}</p>
              <ul>
                {g.items.map((item) => {
                  const Icon = item.icon;
                  const isCurrent = current === item.href;
                  const isActive = active === item.href;
                  return (
                    <li key={item.href}>
                      <NavigationMenu.Link
                        active={isCurrent}
                        closeOnClick
                        render={<Link href={item.href} />}
                        onPointerEnter={() => setActive(item.href)}
                        onFocus={() => setActive(item.href)}
                        className="group/item relative flex items-center gap-3 rounded-lg px-2.5 py-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      >
                        {isActive ? (
                          <motion.span
                            layoutId="solutions-highlight"
                            aria-hidden
                            className="absolute inset-0 rounded-lg bg-muted dark:bg-white/[0.06]"
                            transition={{ type: "spring", stiffness: 520, damping: 40, mass: 0.6 }}
                          />
                        ) : null}
                        {isCurrent && !isActive ? <span aria-hidden className="absolute inset-0 rounded-lg bg-primary/[0.06] dark:bg-primary/15" /> : null}
                        <span
                          className={cn(
                            "relative grid size-8 shrink-0 place-items-center rounded-lg bg-primary/[0.07] text-primary transition-colors duration-150 dark:bg-primary/15",
                            (isActive || isCurrent) && "bg-primary text-primary-foreground dark:bg-primary",
                          )}
                        >
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="relative min-w-0 flex-1">
                          <span className={cn("flex items-center gap-1.5 text-sm font-medium text-foreground", isCurrent && "text-primary")}>
                            {item.label}
                            {item.account && !signedIn ? <Lock className="size-3 text-muted-foreground" aria-label="Sign-in required" /> : null}
                          </span>
                          <span className="block truncate text-[0.78rem] text-muted-foreground">{item.description}</span>
                        </span>
                        <ArrowRight
                          aria-hidden
                          className={cn(
                            "relative size-3.5 shrink-0 text-primary transition-[opacity,transform] duration-150 motion-reduce:transition-none",
                            isActive ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0",
                          )}
                        />
                      </NavigationMenu.Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        {/* What the highlighted destination offers (the link text already carries this for screen readers). */}
        <p aria-hidden className="mt-2 flex h-9 items-center gap-2 rounded-lg bg-muted/50 px-3 text-[0.78rem] text-muted-foreground dark:bg-white/[0.03]">
          <span className={cn("size-1.5 shrink-0 rounded-full transition-colors duration-150", activeItem ? "bg-primary" : "bg-lime")} />
          <motion.span key={hint} initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="truncate">
            {hint}
          </motion.span>
        </p>
      </NavigationMenu.Content>
    </NavigationMenu.Item>
  );
}

/** The header NavigationMenu's popup: one surface, collision-aware, quick transitions. */
export function SolutionsMenuPortal() {
  return (
    <NavigationMenu.Portal>
      <NavigationMenu.Positioner sideOffset={8} collisionPadding={16} align="center" className="z-50 outline-none">
        <NavigationMenu.Popup className={cn(popupSurface, "origin-(--transform-origin)")}>
          <NavigationMenu.Viewport className="relative overflow-hidden" />
        </NavigationMenu.Popup>
      </NavigationMenu.Positioner>
    </NavigationMenu.Portal>
  );
}

/** Phone menu: the same destinations as a grouped accordion (titles only, large rows). */
export function MobileSolutions({ onNavigate }: { onNavigate: () => void }) {
  const current = useCurrentHref();
  return (
    <Accordion.Root defaultValue={current ? ["solutions"] : []}>
      <Accordion.Item value="solutions">
        <Accordion.Header>
          <Accordion.Trigger className="group flex w-full items-center justify-between rounded-xl px-4 py-3 text-base font-medium transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/40">
            More Solutions
            <ChevronDown className="size-4 text-muted-foreground transition-transform duration-150 group-data-panel-open:rotate-180 motion-reduce:transition-none" aria-hidden />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel className="h-(--accordion-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
          <div className="pb-2">
            {SOLUTION_GROUPS.map((g) => (
              <div key={g.title}>
                <p className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground">{g.title}</p>
                {/* The phone sheet already has its own AI Tools button, so it isn't repeated here. */}
                {g.items.filter((item) => item.href !== "/ai-tools").map((item) => {
                  const Icon = item.icon;
                  const isCurrent = current === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isCurrent ? "page" : undefined}
                      className={cn("group/item flex min-h-12 items-center gap-3 rounded-xl px-4 text-[0.95rem] font-medium transition-colors duration-150 hover:bg-muted active:bg-muted", isCurrent && "bg-primary/[0.06] text-primary dark:bg-primary/15")}
                    >
                      <Icon className={iconClass} aria-hidden />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  );
}
