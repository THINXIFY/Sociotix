"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Popover } from "@base-ui/react/popover";
import { Menu } from "@base-ui/react/menu";
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  CircleCheck,
  CircleUserRound,
  FlaskConical,
  Languages,
  LogOut,
  Moon,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { ThemeToggle } from "@/components/site/header";
import { type ActivityKind, DEMO_WALLET, money, usd } from "@/lib/demo-account";
import { signOutAction } from "@/app/(auth)/actions";
import { useViewer } from "@/components/auth/viewer";
import { useLiveAccount } from "./live-account";
import { GlobalSearchTrigger } from "./global-search";
import { LiveNotifications } from "./live-notifications";
import { languageOf, t, useDisplaySettings } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { markNotificationsRead, resetDemoData, useDemoActivity, useAvatarPreview, useDemoOrders, useDemoPrefsSaved, useOrderingChanges, usePaymentPreviews, useProfile, useTickets, whenLabel } from "./demo-store";
import { offersLanguages, RegionDialog } from "./region";
import { DemoTag, useDestinations } from "./shared";
import { menuItem as sharedMenuItem, menuItemDestructive, popupSurface } from "@/components/ui/menu";

/* -------------------------------------------------------------------------- */
/*  Notifications                                                             */
/* -------------------------------------------------------------------------- */

export const ACTIVITY_ICONS: Record<ActivityKind, { Icon: typeof Bell; className: string }> = {
  progress: { Icon: RefreshCw, className: "bg-secondary text-secondary-foreground" },
  attention: { Icon: TriangleAlert, className: "bg-soon-soft text-soon" },
  wallet: { Icon: Wallet, className: "bg-lime/40 text-graphite dark:bg-lime/15 dark:text-lime" },
  completed: { Icon: CircleCheck, className: "bg-ok-soft text-ok" },
  support: { Icon: CircleUserRound, className: "bg-muted text-muted-foreground" },
  demo: { Icon: FlaskConical, className: "border border-dashed border-primary/40 bg-card text-primary" },
};

// The shared menu look (same as admin): one surface, row height, highlight and disabled state everywhere.
const popupClass = popupSurface;

const iconButton =
  "relative grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none data-popup-open:bg-muted data-popup-open:text-foreground";

function Notifications() {
  const { activity, unread: unreadIds } = useDemoActivity();
  const unread = unreadIds.length;

  return (
    <Popover.Root>
      <Popover.Trigger className={iconButton} data-tour="notifications" aria-label={unread ? t("notif.unreadCount", { count: unread }) : t("notif.title")}>
        <Bell className="size-[1.1rem]" aria-hidden />
        {unread ? (
          <span className="absolute top-1 end-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.6rem] font-bold text-primary-foreground ring-2 ring-background">
            {unread}
          </span>
        ) : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} collisionPadding={12} className="z-50">
          <Popover.Popup className={cn(popupClass, "w-[min(23rem,calc(100vw-1.5rem))]")}>
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <Popover.Title className="font-heading text-sm font-bold">{t("notif.title")}</Popover.Title>
                <DemoTag className="text-muted-foreground" />
              </div>
              <button
                type="button"
                disabled={!unread}
                onClick={() => markNotificationsRead(unreadIds)}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-secondary disabled:pointer-events-none disabled:text-muted-foreground"
              >
                <CheckCheck className="size-3.5" aria-hidden /> {t("notif.markAll")}
              </button>
            </div>
            {activity.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up. Updates about your orders and payments will appear here.</p>
            ) : null}
            <ul className="max-h-[min(24rem,60vh)] overflow-y-auto p-1.5 empty:hidden">
              {activity.map((a) => {
                const { Icon, className } = ACTIVITY_ICONS[a.kind];
                const isUnread = unreadIds.includes(a.id);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => markNotificationsRead([a.id])}
                      className="flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-start transition-colors hover:bg-muted"
                    >
                      <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", className)}>
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm", isUnread ? "font-semibold" : "font-medium text-muted-foreground")}>
                          {a.title}
                        </span>
                        <span className="block text-xs text-muted-foreground">{a.detail}</span>
                        <span className="mt-1 block text-[0.7rem] text-muted-foreground/80">{whenLabel(a.when)}</span>
                      </span>
                      {isUnread ? (
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label={t("notif.unread")} />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            {languageOf().code !== "en" ? (
              <p className="border-t px-4 py-2 text-[0.7rem] text-muted-foreground">{t("notif.contentNote")}</p>
            ) : null}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* -------------------------------------------------------------------------- */
/*  Profile menu                                                              */
/* -------------------------------------------------------------------------- */

const menuItem = sharedMenuItem;

export function Avatar({ className }: { className?: string }) {
  const { initials } = useProfile();
  const photo = useAvatarPreview();
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-linear-to-br from-[#7047eb] to-[#5a35d8] font-heading text-xs font-bold text-white",
        className,
      )}
      aria-hidden
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL preview, never uploaded
        <img src={photo} alt="" className="size-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

function ProfileMenu() {
  const viewer = useViewer();
  const { fullName, profile } = useProfile();
  const { resolvedTheme, setTheme } = useTheme();
  const { edited } = useProfile();
  const live = useLiveAccount();
  const prefsSaved = useDemoPrefsSaved();
  const display = useDisplaySettings();
  const [regionOpen, setRegionOpen] = React.useState(false);
  const changes =
    useDemoOrders().changes +
    usePaymentPreviews().length +
    useTickets().changes +
    useOrderingChanges() +
    (edited ? 1 : 0) +
    (prefsSaved ? 1 : 0);
  return (
    <>
    <Menu.Root>
      <Menu.Trigger
        className="flex items-center gap-2.5 rounded-full p-0.5 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none data-popup-open:bg-muted xl:pe-3"
      >
        <Avatar />
        <span className="hidden text-start xl:block">
          <span className="block text-sm leading-tight font-semibold">{fullName}</span>
          <span className="block text-[0.7rem] leading-tight text-muted-foreground">{live ? live.profile.accountRef : t("menu.demoAccount")}</span>
        </span>
        <span className="sr-only">{t("menu.label")}</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8} collisionPadding={12} className="z-50">
          <Menu.Popup className={cn(popupClass, "w-[17.5rem] p-1.5")}>
            <div className="flex items-center gap-3 px-2.5 py-2">
              <Avatar />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{viewer?.demo ? fullName : (viewer?.name ?? fullName)}</p>
                <p className="truncate text-xs text-muted-foreground">{viewer?.demo ? `Signed in as ${viewer.email}` : (viewer?.email ?? profile.email)}</p>
              </div>
            </div>
            <Menu.Separator className="my-1.5 h-px bg-border" />
            <Menu.LinkItem className={menuItem} render={<Link href="/dashboard/profile" />}>
              <CircleUserRound aria-hidden /> {t("nav.profile")}
            </Menu.LinkItem>
            <Menu.LinkItem className={menuItem} render={<Link href="/dashboard/settings" />}>
              <Settings aria-hidden /> {t("nav.settings")}
            </Menu.LinkItem>
            <Menu.LinkItem className={menuItem} render={<Link href="/dashboard/security" />}>
              <ShieldCheck aria-hidden /> Sign-in &amp; security
            </Menu.LinkItem>
            <Menu.LinkItem className={menuItem} render={<Link href="/ai-tools" />}>
              <Sparkles aria-hidden /> <span className="flex-1">AI Tools</span>
              <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[0.6rem] font-bold text-secondary-foreground">New</span>
            </Menu.LinkItem>
            <Menu.Item className={menuItem} onClick={() => setRegionOpen(true)}>
              <Languages aria-hidden />
              <span className="flex-1">{t("menu.region")}</span>
              <span className="font-mono text-[0.7rem] text-muted-foreground uppercase">
                {offersLanguages() ? `${display.language} · ` : ""}
                {display.currency}
              </span>
            </Menu.Item>
            <Menu.Item
              className={menuItem}
              closeOnClick={false}
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              <Moon className="dark:hidden" aria-hidden />
              <Sun className="hidden dark:block" aria-hidden />
              <span className="dark:hidden">{t("menu.darkMode")}</span>
              <span className="hidden dark:inline">{t("menu.lightMode")}</span>
            </Menu.Item>
            {live ? null : (
              <Menu.Item className={menuItem} disabled={!changes} onClick={resetDemoData}>
                <RotateCcw aria-hidden />
                <span className="flex-1">{t("menu.reset")}</span>
                {changes ? <span className="text-xs text-muted-foreground tabular-nums">{changes}</span> : null}
              </Menu.Item>
            )}
            <Menu.Separator className="my-1.5 h-px bg-border" />
            <Menu.LinkItem className={menuItem} render={<Link href="/" />}>
              <ArrowLeft aria-hidden /> {t("nav.backToWebsite")}
            </Menu.LinkItem>
            <Menu.Item className={cn(menuItem, menuItemDestructive)} onClick={() => void signOutAction()}>
              <LogOut aria-hidden /> {t("menu.signOut")}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
    <RegionDialog open={regionOpen} onOpenChange={setRegionOpen} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Top bar                                                                   */
/* -------------------------------------------------------------------------- */

export function TopBar({ mobileLogo, onOpenSearch }: { mobileLogo: React.ReactNode; onOpenSearch: () => void }) {
  const go = useDestinations();
  // Live mode: the real wallet balance (USD, from the ledger). Adding funds isn't open yet, so the pill opens the wallet history.
  const live = useLiveAccount();
  const balance = live ? usd(live.wallet.availableCents / 100) : money(DEMO_WALLET.balance);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenSearch();
      }
    };
    // Capture phase: a page field that stops key events (e.g. on New Order) can't swallow the shortcut.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onOpenSearch]);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-16 max-w-[90rem] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <div className="lg:hidden">{mobileLogo}</div>

        <GlobalSearchTrigger onOpen={onOpenSearch} className="hidden max-w-md flex-1 md:flex" data-tour="search" />

        <div className="ms-auto flex items-center gap-1 sm:gap-1.5">
          <button type="button" className={cn(iconButton, "md:hidden")} data-tour="search" aria-label={t("search.label")} onClick={onOpenSearch}>
            <Search className="size-[1.1rem]" aria-hidden />
          </button>

          <button
            type="button"
            onClick={() => go(live ? "transactions" : "add-funds")}
            className="group me-1 flex h-9 items-center gap-2 rounded-full border bg-card pe-1 ps-3 text-sm shadow-xs transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none"
            data-tour="wallet"
            aria-label={live ? `Wallet balance ${balance}. View wallet history` : t("topbar.balance", { amount: balance })}
          >
            <Wallet className="size-4 text-primary" aria-hidden />
            <span className={cn("font-heading font-bold tabular-nums", live && "pe-2")}>{balance}</span>
            {live ? null : (
              <>
                <span className="hidden rounded-full bg-muted px-1.5 py-0.5 text-[0.6rem] font-bold tracking-wider text-muted-foreground uppercase sm:inline">
                  {t("common.demo")}
                </span>
                <span className="grid size-7 place-items-center rounded-full bg-lime text-graphite transition-transform group-hover:scale-105">
                  <Plus className="size-3.5" strokeWidth={2.75} aria-hidden />
                </span>
              </>
            )}
          </button>

          {live ? <LiveNotifications /> : <Notifications />}
          <ThemeToggle className="hidden text-muted-foreground sm:inline-flex" />
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}
