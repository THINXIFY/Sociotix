import type { DigitalProduct } from "./index";

/* Shapes for the customer's Digital Library (dashboard). No server imports; never carries link URLs or file bytes. */

export const LIBRARY_PATH = "/dashboard/digital-products";
export const libraryHref = (slug: string) => `${LIBRARY_PATH}/${slug}`;

/** Through the permission-checked endpoints from DP-03. */
export const fileDownloadHref = (slug: string, fileId: string) => `/api/digital-products/${slug}/files/${fileId}`;
export const linkDownloadHref = (slug: string, linkId: string) => `/api/digital-products/${slug}/links/${linkId}`;

export interface LibraryItem {
  product: DigitalProduct;
  updatedAt: string;
  /** The customer's most recent download of this product, from the audit log. */
  lastDownloadedAt: string | null;
  /** New files were added since that download. */
  hasUpdate: boolean;
}

export interface DownloadRecord {
  id: string;
  at: string;
  productTitle: string;
  productSlug: string | null;
  kind: "file" | "link";
  name: string;
  version: string;
  /** Where to download it again, when the customer is still allowed to and it still exists. */
  href: string | null;
  /** Why it can't be downloaded again (when href is null). */
  unavailable?: "removed" | "no_access";
}

export interface CustomerLibrary {
  items: LibraryItem[];
  history: DownloadRecord[];
  summary: { products: number; files: number; links: number };
}
