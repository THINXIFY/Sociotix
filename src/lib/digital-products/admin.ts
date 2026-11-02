import type { RichBlock } from "@/lib/blog/types";
import type { Availability, CategoryId, ProductType } from "./index";

/* Shapes shared by the Digital Products admin API and its screens (no server imports). */

export type ProductStatus = "draft" | "published" | "archived";
export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = { draft: "Draft", published: "Published", archived: "Archived" };
export type Pricing = "free" | "paid" | "unset";
export const CURRENCIES = ["USD", "EUR", "GBP", "PKR"] as const;
export const LICENSE_TYPES = ["", "Personal use", "Commercial use", "Extended commercial use", "Custom"] as const;

export const PRODUCT_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface ImageRef {
  mediaId: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  mime: string;
}

export interface DownloadLink {
  id: string;
  url: string;
  label: string;
  title: string;
  instructions: string;
}

export interface ProductFile {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  version: string;
  createdAt: string;
}

/** Everything the editor sends when saving. Images are referenced by media id. */
export interface ProductFields {
  title: string;
  slug: string;
  shortDescription: string;
  content: RichBlock[];
  category: CategoryId;
  productType: ProductType;
  tags: string[];
  pricing: Pricing;
  priceCents: number | null;
  currency: string;
  availability: Availability;
  featured: boolean;
  featuredImageId: string | null;
  featuredImageAlt: string;
  gallery: { mediaId: string; alt: string }[];
  includes: string[];
  highlights: string[];
  specifications: string[];
  compatibility: string[];
  requirements: string[];
  licenseType: string;
  usageTerms: string;
  downloadLinks: DownloadLink[];
  focusKeyword: string;
  keywords: string[];
  seoTitle: string;
  metaDescription: string;
  socialTitle: string;
  socialDescription: string;
  socialImageId: string | null;
}

export interface AdminProduct extends ProductFields {
  id: string;
  status: ProductStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  featuredImage: ImageRef | null;
  galleryImages: ImageRef[];
  socialImage: ImageRef | null;
  files: ProductFile[];
  categoryName: string;
  /** Canonical public address (from the site's configured URL). */
  url: string;
}

export interface AdminProductRow {
  id: string;
  title: string;
  slug: string;
  category: CategoryId;
  categoryName: string;
  pricing: Pricing;
  priceCents: number | null;
  currency: string;
  status: ProductStatus;
  availability: Availability;
  updatedAt: string;
  publishedAt: string | null;
  thumbnail: { src: string } | null;
  fileCount: number;
  linkCount: number;
  version: number;
}

export interface AdminProductList {
  items: AdminProductRow[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  counts: Record<ProductStatus | "all", number>;
  metrics: { free: number; paid: number; withDownloads: number };
}

/** Recognisable hosts for external download links (display only; links are never fetched by the server). */
export function linkProvider(url: string): string | null {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  const is = (d: string) => host === d || host.endsWith(`.${d}`);
  if (is("drive.google.com") || is("docs.google.com")) return "Google Drive";
  if (is("dropbox.com") || is("dropboxusercontent.com")) return "Dropbox";
  if (is("onedrive.live.com") || is("1drv.ms") || is("sharepoint.com")) return "OneDrive";
  if (is("mega.nz")) return "MEGA";
  if (is("box.com")) return "Box";
  if (is("github.com")) return "GitHub";
  if (is("notion.so") || is("notion.site")) return "Notion";
  if (is("canva.com")) return "Canva";
  return null;
}

export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

export const DOWNLOADABLE_TYPES: Record<string, string> = {
  "application/zip": "ZIP",
  "application/pdf": "PDF",
  "application/epub+zip": "EPUB",
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/webp": "WebP",
};
export const MAX_PRODUCT_FILE_BYTES = 8 * 1024 * 1024;
