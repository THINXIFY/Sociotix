/*
 * The official Sociotix logo collection (public/brand), offered as-is for download. Each file is the
 * approved artwork at full resolution with a transparent background. The site itself uses web-sized
 * copies in public/brand/web.
 */

export type BrandAsset = { id: string; label: string; file: string; format: "PNG"; size: string; background: "light" | "dark"; use: string };

const f = (name: string) => `/brand/${name}`;

export const BRAND_ASSETS: BrandAsset[] = [
  { id: "logo", label: "Primary logo", file: f("Sociotix_Light_theme_logo.png"), format: "PNG", size: "1862 × 447", background: "light", use: "Light backgrounds" },
  { id: "logo-dark", label: "Primary logo, dark", file: f("Sociotix_dark_theme_logo.png"), format: "PNG", size: "1902 × 468", background: "dark", use: "Dark backgrounds" },
  { id: "stacked", label: "Stacked logo", file: f("Sociotix_light_mode_stacked_logo.png"), format: "PNG", size: "1014 × 695", background: "light", use: "Square spaces, light" },
  { id: "stacked-dark", label: "Stacked logo, dark", file: f("Sociotix_dark_mode_stacked_logo.png"), format: "PNG", size: "1022 × 702", background: "dark", use: "Square spaces, dark" },
  { id: "wordmark", label: "Wordmark", file: f("Sociotix_black_and_Violet_Wordmark.png"), format: "PNG", size: "1656 × 366", background: "light", use: "Text-only, light" },
  { id: "wordmark-dark", label: "Wordmark, dark", file: f("Sociotix_White_and_Violet_Wordmark.png"), format: "PNG", size: "1839 × 414", background: "dark", use: "Text-only, dark" },
  { id: "mono", label: "Monochrome logo", file: f("Monochrome_Sociotix_Logo.png"), format: "PNG", size: "1935 × 480", background: "light", use: "One-colour print, light" },
  { id: "mono-white", label: "Monochrome logo, white", file: f("Monochrome_Sociotix_Logo_white.png"), format: "PNG", size: "1932 × 477", background: "dark", use: "One-colour print, dark" },
  { id: "icon", label: "Icon, violet", file: f("Sociotix_icon_violet_favicon.png"), format: "PNG", size: "850 × 846", background: "light", use: "App icons, avatars, favicons" },
  { id: "icon-black", label: "Icon, black", file: f("Sociotix_icon_black_favicon.png"), format: "PNG", size: "904 × 907", background: "light", use: "On violet or busy backgrounds" },
];

export const brandAsset = (id: string) => BRAND_ASSETS.find((a) => a.id === id)!;

export const BRAND_COLORS = [
  { name: "Electric Violet", hex: "#7047EB", role: "Primary. Actions, highlights and the icon.", ink: "#FFFFFF" },
  { name: "Restrained Lime", hex: "#C8FF52", role: "Accent. Used sparingly, like the dot in the icon.", ink: "#202127" },
  { name: "Graphite", hex: "#202127", role: "Text and dark surfaces.", ink: "#FFFFFF" },
] as const;

export const MEDIA_CONTACT = "hello@sociotix.com";
