"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { signOutAction } from "@/app/(auth)/actions";
import {
  BadgeCheck,
  Bell,
  Globe,
  KeyRound,
  Laptop,
  LifeBuoy,
  Lock,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Pencil,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Trash2,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/demo-support";
import { NOTIFICATION_PREFS, TIMEZONES } from "@/lib/account";
import { type DateFormat, formatDate, type MessageKey, saveDisplay, t, timeZoneName, tRich, useDisplay } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ConfirmDialog, PendingBadge, SavedNote, Section, SettingRow, Switch, useSavedFlash } from "./account-ui";
import { resetDemoData, savePreferences, usePreferences, useProfile } from "./demo-store";
import { useLiveAccount } from "./live-account";
import { OnboardingSettingsButton } from "./onboarding";
import { GuidedToursRow } from "./tours-settings";
import { CurrencyPicker, LanguagePicker, offersLanguages } from "./region";
import { enter, Panel, ROUTES, useHydrated } from "./shared";
import { Select } from "@/components/ui/select";

/** Four groups; Preferences holds several sections, each with its own anchor. */
const GROUPS = [
  { id: "account", key: "settings.nav.account", icon: UserRound, sections: ["account"] },
  { id: "security", key: "settings.nav.securityOnly", icon: ShieldCheck, sections: ["security"] },
  { id: "appearance", key: "settings.nav.preferences", icon: SlidersHorizontal, sections: ["appearance", "region", "notifications", "preferences"] },
  { id: "privacy", key: "settings.nav.privacy", icon: Lock, sections: ["privacy"] },
] as const satisfies readonly { id: string; key: MessageKey; icon: unknown; sections: readonly string[] }[];

type GroupId = (typeof GROUPS)[number]["id"];
const SECTION_IDS: string[] = GROUPS.flatMap((g) => [...g.sections]);
const groupOf = (section: string): GroupId => GROUPS.find((g) => (g.sections as readonly string[]).includes(section))?.id ?? "account";

const selectClass =
  "h-11 w-full appearance-none rounded-xl border bg-card ps-3.5 pe-9 text-sm font-medium shadow-xs outline-none transition-colors hover:border-foreground/20 focus-visible:border-primary/50 focus-visible:ring-3 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60 sm:h-10 sm:w-80";

const quietButton =
  "inline-flex h-11 items-center gap-1.5 rounded-full border bg-card px-4 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none sm:h-9 sm:px-3.5";

/** Highlights the group whose section is currently in view. */
function useActiveGroup() {
  const [active, setActive] = React.useState<GroupId>("account");
  React.useEffect(() => {
    const els = SECTION_IDS.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(groupOf(visible[0].target.id));
      },
      { rootMargin: "-120px 0px -55% 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return [active, setActive] as const;
}

export function Settings() {
  // Re-render when language, currency, time zone or date format change.
  useDisplay();
  const [active, setActive] = useActiveGroup();
  const e = [0, 1].map(enter);

  const jump = (id: GroupId) => {
    setActive(id);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.hasAttribute("data-reduce-motion");
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <div className="mx-auto max-w-[90rem] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <header className={e[0].className} style={e[0].style}>
        <h1 className="font-heading text-[1.6rem] leading-tight font-extrabold tracking-tight sm:text-[1.9rem]">{t("settings.title")}</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground sm:text-[0.95rem]">{t("settings.subtitle")}</p>
      </header>

      <div className={cn("mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-8", e[1].className)} style={e[1].style}>
        <nav
          aria-label={t("settings.sections")}
          className="sticky top-16 z-20 -mx-3 bg-background/90 px-3 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-24 lg:mx-0 lg:self-start lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
        >
          <ul className="flex gap-1 overflow-x-auto no-scrollbar lg:flex-col">
            {GROUPS.map((g) => {
              const on = active === g.id;
              return (
                <li key={g.id} className="shrink-0">
                  <a
                    href={`#${g.id}`}
                    onClick={(ev) => {
                      ev.preventDefault();
                      jump(g.id);
                    }}
                    aria-current={on ? "true" : undefined}
                    className={cn(
                      "flex h-11 items-center gap-2.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none lg:h-10 lg:rounded-xl",
                      on && "bg-card text-foreground shadow-sm ring-1 ring-border lg:bg-secondary/70 lg:text-secondary-foreground lg:shadow-none lg:ring-0",
                    )}
                  >
                    <g.icon className="size-4 shrink-0" aria-hidden />
                    {t(g.key)}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 space-y-4">
          <Panel className="divide-y px-5 py-6 sm:px-7">
            <AccountSection />
          </Panel>
          <Panel className="divide-y px-5 py-6 sm:px-7">
            <Security />
          </Panel>
          <Panel className="divide-y px-5 py-6 sm:px-7">
            <Appearance />
            <Region />
            <Notifications />
            <PreferencesSection />
          </Panel>
          <Panel className="divide-y px-5 py-6 sm:px-7">
            <Privacy />
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Account                                                                   */
/* -------------------------------------------------------------------------- */

function AccountSection() {
  const live = useLiveAccount();
  const { profile, fullName, initials } = useProfile();
  const [preview, setPreview] = React.useState(false);
  const verified = live ? live.profile.emailVerified : false;

  return (
    <Section id="account" title={t("settings.nav.account")} description={t("account.infoDesc")} icon={UserRound}>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-3 sm:p-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary font-heading text-sm font-extrabold text-primary-foreground" aria-hidden>
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{fullName || profile.displayName}</p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8rem] text-muted-foreground">
            <span className="truncate" dir="ltr">
              {profile.email}
            </span>
            {verified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-0.5 text-[0.68rem] font-semibold text-ok">
                <BadgeCheck className="size-3" aria-hidden /> {t("account.verified")}
              </span>
            ) : (
              <PendingBadge>{t("account.unverified")}</PendingBadge>
            )}
          </p>
        </div>
        <Link href={ROUTES.profile} className={quietButton}>
          <Pencil className="size-3.5" aria-hidden /> {t("account.editProfile")}
        </Link>
      </div>

      <div className="mt-5 divide-y">
        <SettingRow
          title={
            <span className="flex items-center gap-2">
              <KeyRound className="size-4 text-muted-foreground" aria-hidden />
              {t("security.password")}
            </span>
          }
          description={t("security.passwordRow")}
          badge={live ? null : <PendingBadge />}
        >
          {live ? (
            <Link href={`${SECURITY_ROUTE}#sec-password`} className={quietButton}>
              {t("security.manage")}
            </Link>
          ) : (
            <button type="button" onClick={() => setPreview(true)} className={quietButton}>
              {t("common.preview")}
            </button>
          )}
        </SettingRow>
      </div>

      <ConfirmDialog open={preview} onOpenChange={setPreview} title={t("security.password")} description={t("security.passwordBody")} icon={KeyRound} />
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Appearance                                                                */
/* -------------------------------------------------------------------------- */

const THEMES = [
  { id: "light", key: "appearance.light", icon: Sun },
  { id: "dark", key: "appearance.dark", icon: Moon },
  { id: "system", key: "appearance.system", icon: Monitor },
] as const;

function ThemeSwatch({ mode }: { mode: "light" | "dark" | "system" }) {
  const pane = (dark: boolean) => (
    <span className={cn("flex h-full flex-1 flex-col gap-1 p-1.5", dark ? "bg-[#17181e]" : "bg-[#f8f9fc]")}>
      <span className={cn("h-1.5 w-2/3 rounded-full", dark ? "bg-white/25" : "bg-graphite/20")} />
      <span className={cn("h-3 rounded", dark ? "bg-white/10" : "bg-white shadow-xs")} />
      <span className="h-1.5 w-1/2 rounded-full bg-primary/70" />
    </span>
  );
  return (
    <span className="flex h-16 overflow-hidden rounded-lg border" aria-hidden>
      {mode === "system" ? (
        <>
          {pane(false)}
          {pane(true)}
        </>
      ) : (
        pane(mode === "dark")
      )}
    </span>
  );
}

function Appearance() {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const prefs = usePreferences();
  const [saved, flash] = useSavedFlash();

  return (
    <Section id="appearance" title={t("settings.nav.appearance")} description={t("appearance.description")} icon={Palette} action={<SavedNote show={saved} />}>
      <fieldset>
        <legend className="text-sm font-semibold">{t("appearance.theme")}</legend>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:max-w-md sm:gap-3">
          {THEMES.map((th) => {
            const on = hydrated && theme === th.id;
            return (
              <label
                key={th.id}
                className={cn(
                  "cursor-pointer rounded-2xl border bg-card p-2 transition-[border-color,box-shadow] select-none hover:border-foreground/25 has-focus-visible:ring-3 has-focus-visible:ring-primary/25",
                  on && "border-primary shadow-[0_0_0_1px_var(--color-primary)] hover:border-primary",
                )}
              >
                <input
                  type="radio"
                  name="theme"
                  value={th.id}
                  checked={on}
                  onChange={() => {
                    setTheme(th.id);
                    flash();
                  }}
                  className="sr-only"
                />
                <ThemeSwatch mode={th.id} />
                <span className="mt-2 flex items-center justify-center gap-1.5 text-sm font-semibold">
                  <th.icon className={cn("size-3.5", on ? "text-primary" : "text-muted-foreground")} aria-hidden />
                  {t(th.key)}
                </span>
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("appearance.systemHint")}</p>
      </fieldset>

      <div className="mt-6 border-t pt-5">
        <SettingRow title={t("appearance.reduceMotion")} description={t("appearance.reduceMotionDesc")} descriptionId="reduce-motion-desc" inline>
          <Switch
            label={t("appearance.reduceMotion")}
            describedBy="reduce-motion-desc"
            checked={prefs.reduceMotion}
            onChange={(v) => {
              savePreferences({ reduceMotion: v });
              flash();
            }}
          />
        </SettingRow>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Language & region                                                         */
/* -------------------------------------------------------------------------- */

function SelectField({
  id,
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Select id={id} value={value} disabled={disabled} onChange={(ev) => onChange?.(ev.target.value)} className={selectClass}>
        {children}
      </Select>
    </div>
  );
}

const DATE_FORMATS: { id: DateFormat; key: MessageKey }[] = [
  { id: "mdy", key: "region.mdy" },
  { id: "dmy", key: "region.dmy" },
  { id: "iso", key: "region.iso" },
];
/** A fixed sample date so each format can be previewed. */
const SAMPLE = "2026-10-27T09:14:00Z";

function Region() {
  const display = useDisplay();
  const [saved, flash] = useSavedFlash();
  const save = (patch: Parameters<typeof saveDisplay>[0]) => {
    saveDisplay(patch);
    flash();
  };

  return (
    <Section id="region" title={t("settings.nav.region")} description={t("region.description")} icon={Globe} action={<SavedNote show={saved} />}>
      {offersLanguages() ? (
        <div className="mb-6 border-b pb-5">
          <p className="text-sm font-semibold">{t("region.language")}</p>
          <p className="mt-0.5 mb-3 text-[0.8rem] text-muted-foreground">{t("region.languageDesc")}</p>
          <LanguagePicker onChange={flash} />
        </div>
      ) : null}

      <div>
        <p className="text-sm font-semibold">{t("region.currency")}</p>
        <p className="mt-0.5 mb-3 text-[0.8rem] text-muted-foreground">{t("region.currencyDesc")}</p>
        <CurrencyPicker />
      </div>

      <div className="mt-6 divide-y border-t pt-5">
        <SettingRow title={t("region.timezone")} description={t("region.timezoneDesc")}>
          <SelectField id="pref-tz" label={t("region.timezone")} value={display.timezone} onChange={(v) => save({ timezone: v })}>
            {TIMEZONES.map((tz) => (
              <option key={tz.id} value={tz.id}>
                {tz.id === "UTC" ? "UTC" : `${timeZoneName(tz.id, tz.label)} · ${tz.id.split("/").pop()?.replace(/_/g, " ")}`}
              </option>
            ))}
          </SelectField>
        </SettingRow>
        <SettingRow title={t("region.dateFormat")} description={t("region.dateFormatDesc")}>
          <SelectField id="pref-date" label={t("region.dateFormat")} value={display.dateFormat} onChange={(v) => save({ dateFormat: v as DateFormat })}>
            {DATE_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {t(f.key)} · {formatDate(SAMPLE, { year: true, format: f.id })}
              </option>
            ))}
          </SelectField>
        </SettingRow>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Notifications                                                             */
/* -------------------------------------------------------------------------- */

function Notifications() {
  const prefs = usePreferences();
  const [saved, flash] = useSavedFlash();
  const live = useLiveAccount();
  if (live) {
    return (
      <Section id="notifications" title={t("settings.nav.notifications")} description={t("notifications.description")} icon={Bell}>
        <p className="flex gap-2.5 rounded-xl bg-muted/60 px-3.5 py-3 text-[0.8rem] leading-relaxed text-muted-foreground">
          <Bell className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("notifications.liveNote")}
        </p>
      </Section>
    );
  }
  return (
    <Section id="notifications" title={t("settings.nav.notifications")} description={t("notifications.description")} icon={Bell} action={<SavedNote show={saved} />}>
      <div className="divide-y">
        {NOTIFICATION_PREFS.map((n) => {
          const label = t(`notifications.${n.id}`);
          return (
            <SettingRow key={n.id} title={label} description={t(`notifications.${n.id}Desc`)} descriptionId={`notif-${n.id}`} inline>
              <Switch
                label={label}
                describedBy={`notif-${n.id}`}
                checked={prefs.notifications[n.id]}
                onChange={(v) => {
                  savePreferences({ notifications: { ...prefs.notifications, [n.id]: v } });
                  flash();
                }}
              />
            </SettingRow>
          );
        })}
      </div>
      <p className="mt-4 rounded-xl bg-muted/60 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">{t("notifications.note")}</p>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Preferences                                                               */
/* -------------------------------------------------------------------------- */

function PreferencesSection() {
  return (
    <Section id="preferences" title={t("settings.nav.preferences")} description={t("preferences.description")} icon={SlidersHorizontal}>
      {/* Goals and platforms from the welcome flow; saved to the account in live mode. */}
      <SettingRow title={t("preferences.platform")} description={t("preferences.platformDesc")}>
        <OnboardingSettingsButton className={quietButton}>{t("preferences.platformAction")}</OnboardingSettingsButton>
      </SettingRow>
      <GuidedToursRow />
      {/* Sociotix AI personalisation (AI-09) is saved on the server; this reopens the short introduction. */}
      <SettingRow title={t("preferences.ai")} description={t("preferences.aiDesc")}>
        <Link href="/dashboard/ai/welcome" className={quietButton}>
          {t("preferences.aiAction")}
        </Link>
      </SettingRow>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Security                                                                  */
/* -------------------------------------------------------------------------- */

type PreviewId = "twoFactor" | "sessions";

const SECURITY_ICONS: Record<PreviewId, typeof KeyRound> = {
  twoFactor: Smartphone,
  sessions: Laptop,
};

const SECURITY_ROUTE = "/dashboard/security";

function Security() {
  const live = useLiveAccount();
  const [preview, setPreview] = React.useState<PreviewId | null>(null);
  const row = (id: PreviewId, control: React.ReactNode, badge: React.ReactNode) => {
    const Icon = SECURITY_ICONS[id];
    return (
      <SettingRow
        key={id}
        title={
          <span className="flex items-center gap-2">
            <Icon className="size-4 text-muted-foreground" aria-hidden />
            {t(`security.${id}`)}
          </span>
        }
        description={t(`security.${id}Row`)}
        badge={badge}
      >
        {control}
      </SettingRow>
    );
  };
  const previewButton = (id: PreviewId) => (
    <button type="button" onClick={() => setPreview(id)} className={quietButton}>
      {t("common.preview")}
    </button>
  );

  return (
    <Section id="security" title={t("settings.nav.securityOnly")} description={live ? t("security.liveDesc") : t("security.description")} icon={ShieldCheck}>
      <div className="divide-y">
        {live
          ? [
              row(
                "sessions",
                <Link href={`${SECURITY_ROUTE}#sec-sessions`} className={quietButton}>
                  {t("security.manage")}
                </Link>,
                null,
              ),
              // Customer accounts don't have an authenticator step yet, so there is nothing to switch on.
              row("twoFactor", null, <PendingBadge>{t("security.notYet")}</PendingBadge>),
            ]
          : [row("sessions", previewButton("sessions"), <PendingBadge />), row("twoFactor", previewButton("twoFactor"), <PendingBadge />)]}
      </div>

      <ConfirmDialog
        open={preview !== null}
        onOpenChange={(o) => !o && setPreview(null)}
        title={preview ? t(`security.${preview}`) : ""}
        description={preview ? t(`security.${preview}Body`) : ""}
        icon={preview ? SECURITY_ICONS[preview] : undefined}
      />
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Privacy & account                                                         */
/* -------------------------------------------------------------------------- */

function Privacy() {
  const [dialog, setDialog] = React.useState<"reset" | "signout" | "delete" | null>(null);
  const [resetDone, setResetDone] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  // A real account has no demo data to reset, and signs out for real.
  const live = useLiveAccount();
  const email = (
    <a href={`mailto:${SUPPORT_EMAIL}`} dir="ltr" className="font-semibold text-primary hover:underline">
      {SUPPORT_EMAIL}
    </a>
  );

  return (
    <Section id="privacy" title={t("settings.nav.privacy")} description={t("privacy.description")} icon={Lock}>
      <div className="rounded-xl border bg-muted/30 p-4">
        <p className="text-sm font-semibold">{t("security.privacy")}</p>
        <ul className="mt-2 space-y-1.5 text-[0.8rem] leading-relaxed text-muted-foreground">
          <li>• {live ? t("privacy.live1") : t("security.privacy1")}</li>
          <li>• {live ? t("privacy.live2") : t("security.privacy2")}</li>
          <li>• {tRich("security.privacy3", { email })}</li>
        </ul>
      </div>

      <div className="mt-5 divide-y">
        {live ? null : (
          <SettingRow title={t("account.reset")} description={t("account.resetDesc")}>
            <button type="button" onClick={() => setDialog("reset")} className={quietButton}>
              <RotateCcw className="size-3.5" aria-hidden /> {t("menu.reset")}
            </button>
          </SettingRow>
        )}
        <SettingRow title={t("account.signOut")} description={t("account.signOutDesc")} badge={live ? null : <PendingBadge />}>
          <button type="button" onClick={() => setDialog("signout")} className={quietButton}>
            <LogOut className="size-3.5" aria-hidden /> {t("account.signOutButton")}
          </button>
        </SettingRow>
      </div>
      <div role="status" className="empty:hidden">
        {resetDone ? (
          <p className="mt-3 flex items-center gap-2 rounded-xl border border-dashed px-3.5 py-2.5 text-sm text-muted-foreground">
            <RotateCcw className="size-4 shrink-0" aria-hidden /> {t("account.resetDone")}
          </p>
        ) : null}
      </div>

      <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/[0.03] p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm font-bold text-destructive">
          <TriangleAlert className="size-4" aria-hidden /> {t("account.danger")}
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              {t("account.delete")} {live ? null : <PendingBadge>{t("account.requestPreview")}</PendingBadge>}
            </p>
            <p className="mt-0.5 text-[0.8rem] text-muted-foreground">{live ? t("account.deleteLive") : t("account.deleteDesc")}</p>
          </div>
          {live ? (
            <Link href={`${ROUTES.support}?new=1`} className={cn(quietButton, "shrink-0")}>
              <LifeBuoy className="size-3.5" aria-hidden /> {t("account.contactSupport")}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setDialog("delete")}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-destructive/40 bg-card px-4 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 focus-visible:ring-3 focus-visible:ring-destructive/30 focus-visible:outline-none sm:h-9 sm:px-3.5"
            >
              <Trash2 className="size-3.5" aria-hidden /> {t("account.requestDeletion")}
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={dialog === "reset"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t("account.resetTitle")}
        description={t("account.resetBody")}
        confirmLabel={t("menu.reset")}
        onConfirm={() => {
          resetDemoData();
          setResetDone(true);
        }}
        icon={RotateCcw}
      />
      {live ? (
        <ConfirmDialog
          open={dialog === "signout"}
          onOpenChange={(o) => !o && setDialog(null)}
          title={t("account.signOut")}
          description={t("account.signOutLiveBody")}
          confirmLabel={signingOut ? "…" : t("account.signOutButton")}
          onConfirm={() => {
            setSigningOut(true);
            void signOutAction();
          }}
          icon={LogOut}
        />
      ) : (
        <ConfirmDialog open={dialog === "signout"} onOpenChange={(o) => !o && setDialog(null)} title={t("account.signOut")} description={t("account.signOutBody")} icon={LogOut} />
      )}
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t("account.delete")}
        description={t("account.deleteBody")}
        tone="danger"
        icon={Trash2}
      >
        <p className="rounded-xl bg-muted/60 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
          {tRich("account.deleteNote", {
            reset: <span className="font-semibold text-foreground">{t("menu.reset")}</span>,
            email,
            support: (
              <Link href={ROUTES.support} className="font-semibold text-primary hover:underline">
                {t("nav.support")}
              </Link>
            ),
          })}
        </p>
      </ConfirmDialog>
    </Section>
  );
}
