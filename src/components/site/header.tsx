"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { motion } from "motion/react";
import { NavigationMenu } from "@base-ui/react/navigation-menu";
import { Menu, Moon, Sparkles, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/brand";
import { HeaderAccount, type HeaderViewer, MobileAccount } from "@/components/site/header-account";
import { controlIcon, controlOutline, NAV_INDICATOR_ID, navIndicator, navIndicatorTransition, navItem, navItemActive, navItemIdle } from "@/components/site/nav-styles";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MobileSolutions, SolutionsMenuItem, SolutionsMenuPortal } from "@/components/site/solutions-menu";
import { cn } from "@/lib/utils";

export const NAV = [
  { label: "Home", href: "#top" },
  { label: "Services", href: "#services" },
  { label: "Platforms", href: "#platforms" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Order Tracking", href: "#order-tracking" },
  { label: "More Solutions", href: "#more-solutions" },
];

function useActiveSection(enabled: boolean) {
  const [active, setActive] = React.useState("#top");
  React.useEffect(() => {
    if (!enabled) return;
    // The nav section crossing a line 40% down the viewport. None while reading a section
    // that has no nav item (dashboard, FAQ…), so a stale item never stays highlighted.
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.4;
      const hit = NAV.find((n) => {
        const r = document.querySelector(n.href)?.getBoundingClientRect();
        return r && r.top <= line && r.bottom > line;
      });
      setActive(hit?.href ?? "");
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [enabled]);
  return active;
}

function useScrolled() {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return scrolled;
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("size-9 rounded-full", className)}
      aria-label="Toggle dark mode"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Moon className="size-[1.1rem] dark:hidden" aria-hidden />
      <Sun className="hidden size-[1.1rem] dark:block" aria-hidden />
    </Button>
  );
}

/** The header's theme control: the compact icon button, with a tooltip naming what it will do. */
function HeaderThemeButton({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const next = resolvedTheme === "dark" ? "light" : "dark";
  return (
    <Tooltip>
      <TooltipTrigger
        delay={400}
        render={<button type="button" className={cn(controlIcon, className)} aria-label="Toggle dark mode" onClick={() => setTheme(next)} />}
      >
        <Moon className="size-[1.05rem] dark:hidden" aria-hidden />
        <Sun className="hidden size-[1.05rem] dark:block" aria-hidden />
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        {next === "dark" ? "Dark mode" : "Light mode"}
      </TooltipContent>
    </Tooltip>
  );
}

/** The Sociotix AI entry point: a distinct link so the SMM navigation stays as it is. */
function AiLink({ current, className, onClick }: { current: boolean; className?: string; onClick?: () => void }) {
  return (
    <Link
      href="/ai-tools"
      onClick={onClick}
      aria-current={current ? "page" : undefined}
      className={cn("group/ai", controlOutline, current && "border-primary/40 bg-primary/[0.06] text-primary dark:bg-primary/15 dark:text-[#c9bcff]", className)}
    >
      <Sparkles className="size-3.5 shrink-0 text-primary transition-transform duration-200 group-hover/ai:rotate-12 motion-reduce:transition-none dark:text-[#b9a6ff]" aria-hidden />
      AI Tools
    </Link>
  );
}

/**
 * The public header. Pages render it through `public-header.tsx`, which resolves `viewer` from the
 * real session on the server; rendered on its own (tests, previews) it shows the guest controls.
 */
export function Header({ page = "home", viewer = { kind: "guest" } }: { page?: "home" | "ai" | "other"; viewer?: HeaderViewer }) {
  const home = page === "home";
  const active = useActiveSection(home);
  // On other pages, section links lead back to the homepage.
  const nav = NAV.map((n) => ({ ...n, href: home ? n.href : `/${n.href}` }));
  const scrolled = useScrolled();
  const [open, setOpen] = React.useState(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-[background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none",
        scrolled
          ? "border-b border-border/60 bg-background/[0.72] shadow-[inset_0_1px_0_rgb(255_255_255/0.55),0_12px_32px_-26px_rgb(32_33_39/0.55)] backdrop-blur-xl backdrop-saturate-[1.8] dark:border-white/[0.07] dark:bg-[#0f1014]/[0.72] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04),0_12px_32px_-22px_rgb(0_0_0/0.9)]"
          : "border-b border-transparent",
      )}
    >
      <a
        href={home ? "#services" : "#main"}
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-soft focus:ring-2 focus:ring-primary/40"
      >
        {home ? "Skip to services" : "Skip to content"}
      </a>
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <a href={home ? "#top" : "/"} aria-label="Sociotix home" className="-ms-1 shrink-0 rounded-lg p-1 outline-none transition-opacity duration-150 hover:opacity-85 focus-visible:ring-2 focus-visible:ring-primary/40">
          <Logo className="h-[30px]" />
        </a>

        {/* "More Solutions" opens a mega menu (hover or click); the other items stay section links. */}
        <NavigationMenu.Root aria-label="Primary" delay={80} closeDelay={200} className="ms-5 hidden xl:block 2xl:ms-8">
          <NavigationMenu.List className="flex items-center gap-1">
            {nav.map((item) => {
              const isActive = home && active === item.href;
              if (item.href.endsWith("#more-solutions")) return <SolutionsMenuItem key={item.href} highlighted={isActive} signedIn={typeof viewer === "object" && viewer.kind === "customer"} />;
              return (
                <li key={item.href}>
                  <a
                    href={item.href}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(navItem, isActive ? navItemActive : navItemIdle)}
                  >
                    {isActive ? <motion.span layoutId={NAV_INDICATOR_ID} aria-hidden className={navIndicator} transition={navIndicatorTransition} /> : null}
                    {item.label}
                  </a>
                </li>
              );
            })}
          </NavigationMenu.List>
          <SolutionsMenuPortal />
        </NavigationMenu.Root>

        {/* One control group: secondary action, icon control, divider, then the account. */}
        <div className="ms-auto flex items-center gap-1.5">
          <AiLink current={page === "ai"} className="hidden md:inline-flex" />
          <HeaderThemeButton className="hidden sm:inline-flex" />
          <span aria-hidden className="mx-1.5 hidden h-6 w-px bg-[linear-gradient(transparent,var(--color-border)_25%,var(--color-border)_75%,transparent)] sm:block dark:bg-[linear-gradient(transparent,rgb(255_255_255/0.12)_25%,rgb(255_255_255/0.12)_75%,transparent)]" />
          <HeaderAccount viewer={viewer} />

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <button type="button" className={cn(controlIcon, "xl:hidden")} aria-label="Open menu" />
              }
            >
              <Menu className="size-5" aria-hidden />
            </SheetTrigger>
            <SheetContent side="right" className="w-[88vw] max-w-sm gap-0 p-0">
              <div className="flex h-16 items-center border-b px-5">
                <SheetTitle render={<span />}>
                  <Logo />
                </SheetTitle>
              </div>
              <nav aria-label="Mobile" className="flex flex-col overflow-y-auto p-3">
                {nav.filter((item) => !item.href.endsWith("#more-solutions")).map((item) => {
                  const current = home && active === item.href;
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={current ? "true" : undefined}
                      className={cn(
                        "relative flex items-center rounded-xl px-4 py-3 text-base font-medium transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none",
                        current ? "bg-primary/[0.06] text-foreground before:absolute before:inset-y-3 before:left-1.5 before:w-0.5 before:rounded-full before:bg-primary dark:bg-primary/15" : "text-foreground/85",
                      )}
                    >
                      {item.label}
                    </a>
                  );
                })}
                <MobileSolutions onNavigate={() => setOpen(false)} />
                <AiLink current={page === "ai"} onClick={() => setOpen(false)} className="mt-3 h-12 rounded-xl text-base" />
              </nav>
              <div className="mt-auto space-y-3 border-t p-4">
                <div className="flex items-center justify-between rounded-xl bg-muted/50 py-1 ps-4 pe-1 text-sm font-medium text-foreground/80 dark:bg-white/[0.04]">
                  Appearance
                  <ThemeToggle className="rounded-lg text-foreground/75" />
                </div>
                <MobileAccount viewer={viewer} onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
