import type { SocialProviderId } from "./platforms";

/* Content workspace (CM-01): limits and small helpers shared by the server, the editor and the library. */

export const HASHTAGS_MAX = 30;
export const HASHTAG_MAX = 50;
export const NOTES_MAX = 2000;
export const FOLDERS_MAX = 50;
export const FOLDER_NAME_MAX = 40;
export const TEMPLATES_MAX = 100;
export const TEMPLATE_NAME_MAX = 60;
export const MEDIA_FILES_MAX = 100;
export const MEDIA_TOTAL_BYTES = 100 * 1024 * 1024;
export const MEDIA_PER_POST_MAX = 10;
export const MEDIA_NAME_MAX = 100;
export const BULK_MAX = 100;

export const CONTENT_ROUTES = { library: "/dashboard/social/content" } as const;

/** Where a library image is served (to its owner only). */
export const mediaUrl = (id: string) => `/media/library/${id}`;

const TAG = /^[\p{L}\p{N}_]+$/u;

/**
 * "#launch, summer sale #Launch" → ["launch", "summer", "sale"]. Splits on spaces and commas, drops the
 * leading #, keeps the first spelling of each tag (compared without case) and ignores anything that isn't
 * letters, digits or underscores. `invalid` lists what was left out.
 */
export function parseHashtags(input: string): { tags: string[]; invalid: string[] } {
  const seen = new Set<string>();
  const tags: string[] = [];
  const invalid: string[] = [];
  for (const raw of input.normalize("NFC").split(/[\s,]+/)) {
    const t = raw.replace(/^#+/, "");
    if (!t) continue;
    if (!TAG.test(t) || Array.from(t).length > HASHTAG_MAX) {
      invalid.push(raw);
      continue;
    }
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    tags.push(t);
  }
  return { tags, invalid };
}

/** The caption with its hashtags on a final line, the way it would read on a platform. */
export const withHashtags = (text: string, tags: readonly string[]) => (tags.length ? `${text.trim() ? `${text.replace(/\s+$/, "")}\n\n` : ""}${tags.map((t) => `#${t}`).join(" ")}` : text);

export interface FolderView {
  id: string;
  name: string;
  /** Posts in the folder (archived ones included). */
  count: number;
}

export interface TemplateView {
  id: string;
  name: string;
  body: string;
  hashtags: string[];
  providers: SocialProviderId[];
  updatedAt: string;
}

export interface MediaView {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
  width: number;
  height: number;
  createdAt: string;
  /** How many posts use it. */
  usedBy: number;
}

/** What the editor and library need besides the posts themselves. */
export interface ContentMeta {
  folders: FolderView[];
  templates: TemplateView[];
  media: MediaView[];
  mediaBytes: number;
}

export const formatBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
