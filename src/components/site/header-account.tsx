"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu } from "@base-ui/react/menu";
import { CircleUserRound, LayoutDashboard, LogOut, Settings, ShieldCheck } from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import { staffSignOutAction } from "@/app/admin/(access)/actions";
import { buttonVariants } from "@/components/ui/button";
import { menuItem, menuItemDestructive, menuPopup, menuSeparator } from "@/components/ui/menu";
import { cn } from "@/lib/utils";

/**
 * Who the public header is showing, resolved on the server from the real session cookie
 * (see `public-header.tsx`). "loading" is the prerendered placeholder while that resolves,
 * so a signed-in visitor never sees Log In / Sign Up flash first.
 */
export type HeaderViewer =
  | { kind: "guest" }
  | { kind: "customer"; name: string; email: string; initials: string; staff: boolean }
  | { kind: "staff"; name: string; email: string; initials: string; roleName: string }
  | "loading";

const dashboardOf = (v: Exclude<HeaderViewer, "loading" | { kind: "guest" }>) => (v.kind === "customer" ? { href: "/dashboard", label: "Dashboard" } : { href: "/admin", label: "Admin" });

/**
 * Re-check the session when the tab comes back into view, so signing in or out in another tab
 * shows up here. It re-renders from the server session; there's no second auth state.
 */
function useRefreshOnReturn() {
  const router = useRouter();
  React.useEffect(() => {
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 5_000) return;
      last = Date.now();
      router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);
}

const avatarClass = "grid size-9 shrink-0 place-items-center rounded-full bg-linear-to-br from-[#7047eb] to-[#5a35d8] font-heading text-xs font-bold text-white";

/** Desktop/tablet header controls: guest buttons, or Dashboard + avatar menu. */
export function HeaderAccount({ viewer }: { viewer: HeaderViewer }) {
  useRefreshOnReturn();
  if (viewer === "loading") {
    // Same footprint as the guest buttons, so nothing jumps when the real state arrives.
    return (
      <span aria-hidden className="flex items-center gap-1.5">
        <span className="hidden h-9 w-[4.5rem] animate-pulse rounded-full bg-muted/70 motion-reduce:animate-none sm:block" />
        <span className="h-9 w-[5.25rem] animate-pulse rounded-full bg-muted/70 motion-reduce:animate-none" />
      </span>
    );
  }
  if (viewer.kind === "guest") {
    return (
      <>
        <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }), "hidden h-9 rounded-full px-4 sm:inline-flex")}>
          Log In
        </Link>
        <Link href="/register" className={cn(buttonVariants(), "h-9 rounded-full px-3 sm:px-4")}>
          Sign Up
        </Link>
      </>
    );
  }
  const dash = dashboardOf(viewer);
  const signOut = () => void (viewer.kind === "customer" ? signOutAction() : staffSignOutAction());
  return (
    <>
      <Link href={dash.href} className={cn(buttonVariants(), "hidden h-9 gap-1.5 rounded-full px-4 sm:inline-flex")}>
        <LayoutDashboard className="size-4" aria-hidden /> {dash.label}
      </Link>
      <Menu.Root>
        <Menu.Trigger className="rounded-full p-0.5 transition-shadow outline-none hover:ring-2 hover:ring-primary/20 focus-visible:ring-3 focus-visible:ring-primary/40 data-popup-open:ring-2 data-popup-open:ring-primary/30">
          <span className={avatarClass} aria-hidden>
            {viewer.initials}
          </span>
          <span className="sr-only">Account menu for {viewer.name}</span>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={8} collisionPadding={12} className="z-50 outline-none">
            <Menu.Popup className={cn(menuPopup, "w-60")}>
              <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-2.5">
                <span className={avatarClass} aria-hidden>
                  {viewer.initials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{viewer.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{viewer.kind === "staff" ? viewer.roleName : viewer.email}</span>
                </span>
              </div>
              <Menu.Separator className={menuSeparator} />
              {viewer.kind === "customer" ? (
                <>
                  <Menu.LinkItem className={menuItem} render={<Link href="/dashboard" />}>
                    <LayoutDashboard aria-hidden /> My Dashboard
                  </Menu.LinkItem>
                  <Menu.LinkItem className={menuItem} render={<Link href="/dashboard/profile" />}>
                    <CircleUserRound aria-hidden /> My Profile
                  </Menu.LinkItem>
                  <Menu.LinkItem className={menuItem} render={<Link href="/dashboard/settings" />}>
                    <Settings aria-hidden /> Settings
                  </Menu.LinkItem>
                  {/* Only when this browser also holds a verified staff session (checked on the server). */}
                  {viewer.staff ? (
                    <Menu.LinkItem className={menuItem} render={<Link href="/admin" />}>
                      <ShieldCheck aria-hidden /> Admin panel
                    </Menu.LinkItem>
                  ) : null}
                </>
              ) : (
                <>
                  <Menu.LinkItem className={menuItem} render={<Link href="/admin" />}>
                    <LayoutDashboard aria-hidden /> Admin overview
                  </Menu.LinkItem>
                  <Menu.LinkItem className={menuItem} render={<Link href="/admin/account" />}>
                    <ShieldCheck aria-hidden /> Account &amp; security
                  </Menu.LinkItem>
                </>
              )}
              <Menu.Separator className={menuSeparator} />
              <Menu.Item className={cn(menuItem, menuItemDestructive)} onClick={signOut}>
                <LogOut aria-hidden /> Log Out
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </>
  );
}

/** Bottom of the phone menu: guest buttons, or Dashboard + Log Out. */
export function MobileAccount({ viewer, onNavigate }: { viewer: HeaderViewer; onNavigate: () => void }) {
  if (viewer === "loading") return <div aria-hidden className="h-11 animate-pulse rounded-full bg-muted/70 motion-reduce:animate-none" />;
  if (viewer.kind === "guest") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Link href="/login" onClick={onNavigate} className={cn(buttonVariants({ variant: "outline" }), "h-11 rounded-full")}>
          Log In
        </Link>
        <Link href="/register" onClick={onNavigate} className={cn(buttonVariants(), "h-11 rounded-full")}>
          Sign Up
        </Link>
      </div>
    );
  }
  const dash = dashboardOf(viewer);
  return (
    <div className="space-y-2">
      <p className="truncate px-1 text-xs text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{viewer.name}</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Link href={dash.href} onClick={onNavigate} className={cn(buttonVariants(), "h-11 gap-1.5 rounded-full")}>
          <LayoutDashboard className="size-4" aria-hidden /> {dash.label}
        </Link>
        <button
          type="button"
          onClick={() => void (viewer.kind === "customer" ? signOutAction() : staffSignOutAction())}
          className={cn(buttonVariants({ variant: "outline" }), "h-11 gap-1.5 rounded-full text-destructive hover:text-destructive")}
        >
          <LogOut className="size-4" aria-hidden /> Log Out
        </button>
      </div>
    </div>
  );
}
