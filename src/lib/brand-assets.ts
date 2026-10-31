/*
 * Downloadable Sociotix brand assets (public/brand). Every file here is an export of the real logo
 * in components/brand.tsx: the mark as vector SVG, and the full logo as transparent PNG rendered in
 * the site's own Manrope (the wordmark is live text, so there's no outlined SVG of it yet).
 */

export type BrandAsset = { id: string; label: string; file: string; format: "SVG" | "PNG"; size: string; use: string };

export const BRAND_ASSETS: BrandAsset[] = [
  { id: "logo", label: "Full logo", file: "/brand/sociotix-logo.png", format: "PNG", size: "1464 × 480, transparent", use: "Light backgrounds" },
  { id: "logo-reversed", label: "Full logo, reversed", file: "/brand/sociotix-logo-reversed.png", format: "PNG", size: "1464 × 480, transparent", use: "Dark backgrounds" },
  { id: "mark-svg", label: "Mark", file: "/brand/sociotix-mark.svg", format: "SVG", size: "Vector", use: "App icons, avatars, small spaces" },
  { id: "mark-png", label: "Mark", file: "/brand/sociotix-mark.png", format: "PNG", size: "1024 × 1024", use: "App icons, avatars, small spaces" },
  { id: "mark-graphite-svg", label: "Mark, graphite", file: "/brand/sociotix-mark-graphite.svg", format: "SVG", size: "Vector", use: "Violet or busy backgrounds" },
  { id: "mark-graphite-png", label: "Mark, graphite", file: "/brand/sociotix-mark-graphite.png", format: "PNG", size: "1024 × 1024", use: "Violet or busy backgrounds" },
];

export const BRAND_COLORS = [
  { name: "Electric Violet", hex: "#7047EB", role: "Primary. Actions, highlights and the mark.", ink: "#FFFFFF" },
  { name: "Restrained Lime", hex: "#C8FF52", role: "Accent. Used sparingly, like the dot in the mark.", ink: "#202127" },
  { name: "Graphite", hex: "#202127", role: "Text and dark surfaces.", ink: "#FFFFFF" },
] as const;

export const MEDIA_CONTACT = "hello@sociotix.com";
