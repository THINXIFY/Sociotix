import {
  siDiscord,
  siFacebook,
  siInstagram,
  siPinterest,
  siReddit,
  siSnapchat,
  siSpotify,
  siTelegram,
  siTiktok,
  siTwitch,
  siWhatsapp,
  siX,
  siYoutube,
} from "simple-icons";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Platform, PlatformIconKey } from "@/lib/catalog";

// LinkedIn isn't distributed by simple-icons; this is a plain "in" glyph.
const LINKEDIN_PATH =
  "M5.34 8.6h3.1V19H5.34zM6.9 3.6a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6M10.38 8.6h2.97v1.42h.04c.41-.78 1.43-1.6 2.94-1.6 3.14 0 3.72 2.07 3.72 4.75V19h-3.1v-5.12c0-1.22-.02-2.79-1.7-2.79-1.7 0-1.96 1.33-1.96 2.7V19h-3.1z";

const PATHS: Record<Exclude<PlatformIconKey, "website">, string> = {
  instagram: siInstagram.path,
  facebook: siFacebook.path,
  x: siX.path,
  youtube: siYoutube.path,
  tiktok: siTiktok.path,
  telegram: siTelegram.path,
  whatsapp: siWhatsapp.path,
  linkedin: LINKEDIN_PATH,
  pinterest: siPinterest.path,
  snapchat: siSnapchat.path,
  twitch: siTwitch.path,
  discord: siDiscord.path,
  reddit: siReddit.path,
  spotify: siSpotify.path,
};

export function PlatformIcon({
  icon,
  className,
  title,
}: {
  icon: PlatformIconKey;
  className?: string;
  title?: string;
}) {
  if (icon === "website") {
    return <Globe className={cn("size-4", className)} strokeWidth={2.2} aria-label={title} aria-hidden={title ? undefined : true} />;
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("size-4", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[icon]} />
    </svg>
  );
}

const TILE_SIZES = {
  xs: "size-6 rounded-md [&_svg]:size-3.5",
  sm: "size-8 rounded-lg [&_svg]:size-4",
  md: "size-11 rounded-xl [&_svg]:size-5",
  lg: "size-14 rounded-2xl [&_svg]:size-7",
} as const;

export function PlatformTile({
  platform,
  size = "md",
  className,
}: {
  platform: Platform;
  size?: keyof typeof TILE_SIZES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center ring-1 ring-black/5 ring-inset dark:ring-white/10",
        TILE_SIZES[size],
        className,
      )}
      style={{ backgroundColor: platform.color, color: platform.ink }}
    >
      <PlatformIcon icon={platform.icon} />
    </span>
  );
}

/** Web-sized copies of the approved artwork in public/brand (originals stay there for downloads). */
export const LOGO_FILES = {
  logoLight: { src: "/brand/web/logo-light.png", width: 505, height: 120 },
  logoDark: { src: "/brand/web/logo-dark.png", width: 504, height: 120 },
  iconViolet: { src: "/brand/web/icon-violet-128.png", width: 128, height: 128 },
  iconBlack: { src: "/brand/web/icon-black-128.png", width: 128, height: 128 },
} as const;

type LogoVariant = "horizontal" | "icon" | "responsive";
type LogoSurface = "auto" | "light" | "dark";

/* eslint-disable @next/next/no-img-element -- small static brand files with fixed dimensions; no optimisation pipeline needed */
function Art({ asset, className, alt }: { asset: (typeof LOGO_FILES)[keyof typeof LOGO_FILES]; className?: string; alt: string }) {
  return <img src={asset.src} width={asset.width} height={asset.height} alt={alt} decoding="async" draggable={false} className={cn("block w-auto max-w-none select-none", className)} />;
}

/**
 * The official Sociotix logo. `surface="auto"` follows the theme (dark-text logo on light, white logo on dark);
 * `light`/`dark` pin it for fixed backgrounds. `icon` shows the violet mark alone; `responsive` uses the mark
 * on phones and the full logo from 640px. Height comes from className (default h-8).
 */
export function Logo({ className, variant = "horizontal", surface = "auto", alt = "Sociotix" }: { className?: string; variant?: LogoVariant; surface?: LogoSurface; alt?: string }) {
  const h = "h-full";
  const horizontal =
    surface === "auto" ? (
      <>
        <Art asset={LOGO_FILES.logoLight} alt={alt} className={cn(h, "dark:hidden")} />
        <Art asset={LOGO_FILES.logoDark} alt={alt} className={cn(h, "hidden dark:block")} />
      </>
    ) : (
      <Art asset={surface === "dark" ? LOGO_FILES.logoDark : LOGO_FILES.logoLight} alt={alt} className={h} />
    );
  const icon = <Art asset={LOGO_FILES.iconViolet} alt={alt} className={h} />;
  return (
    <span className={cn("inline-flex h-8 shrink-0 items-center", className)}>
      {variant === "icon" ? icon : variant === "horizontal" ? horizontal : (
        <>
          <span className="contents sm:hidden">{icon}</span>
          <span className="hidden h-full sm:contents">{horizontal}</span>
        </>
      )}
    </span>
  );
}
/* eslint-enable @next/next/no-img-element */
