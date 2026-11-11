"use client";

import * as React from "react";
import { Check, ImagePlus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatBytes, MEDIA_FILES_MAX, mediaUrl, type MediaView } from "@/lib/social/content";
import { cn } from "@/lib/utils";
import { primaryButton, quietButton } from "./parts";

/* Content workspace (CM-01): pieces shared by the editor and the library page. */

export const fieldClass =
  "w-full rounded-2xl border bg-background px-3.5 py-2.5 text-[0.92rem] outline-none transition-[border-color,box-shadow] focus-visible:border-primary/40 focus-visible:ring-3 focus-visible:ring-primary/20 dark:bg-white/[0.02]";
export const labelClass = "text-[0.78rem] font-semibold";

export const ACCEPT = "image/jpeg,image/png,image/webp";
const OK_TYPES = new Set(ACCEPT.split(","));
const MAX_BYTES = 5 * 1024 * 1024;

/** Uploads one image to the signed-in customer's media library. The server re-checks everything. */
export async function uploadMediaFile(file: File): Promise<{ ok: true; media: MediaView } | { ok: false; message: string }> {
  if (!OK_TYPES.has(file.type)) return { ok: false, message: `${file.name}: use a JPEG, PNG or WebP image.` };
  if (file.size > MAX_BYTES) return { ok: false, message: `${file.name}: images can be up to 5 MB.` };
  const body = new FormData();
  body.append("file", file);
  try {
    const res = await fetch("/api/content/media", { method: "POST", body });
    const json = await res.json().catch(() => null);
    if (res.ok) return { ok: true, media: json.media as MediaView };
    return { ok: false, message: `${file.name}: ${json?.error?.message ?? "the upload didn't work. Please try again."}` };
  } catch {
    return { ok: false, message: `${file.name}: we couldn't reach Sociotix. Check your connection and try again.` };
  }
}

/** Uploads several files one after another, reporting each failure by name. */
export async function uploadMany(files: File[], onAdded: (m: MediaView) => void): Promise<string[]> {
  const problems: string[] = [];
  for (const f of files) {
    const r = await uploadMediaFile(f);
    if (r.ok) onAdded(r.media);
    else problems.push(r.message);
  }
  return problems;
}

export function MediaThumb({ id, name, className }: { id: string; name: string; className?: string }) {
  return (
    // The image is the customer's own, served privately by /media/library; its size is unknown until it loads, so Next's optimizer doesn't apply.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={mediaUrl(id)} alt={name} loading="lazy" decoding="async" className={cn("size-full object-cover", className)} />
  );
}

/** Replaces or merges a library list after an upload (the same file uploaded twice is one entry). */
export const addToLibrary = (list: MediaView[], m: MediaView) => (list.some((x) => x.id === m.id) ? list : [m, ...list]);

export function UploadButton({ onFiles, busy, className, children }: { onFiles: (files: File[]) => void; busy: boolean; className?: string; children?: React.ReactNode }) {
  const input = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
      <button type="button" className={cn(primaryButton, className)} disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
        {busy ? "Uploading…" : (children ?? "Upload images")}
      </button>
    </>
  );
}

/** Choose images from the library for a draft, or upload new ones without leaving the editor. */
export function MediaPicker({
  open,
  onOpenChange,
  library,
  onLibraryChange,
  selected,
  onChange,
  max,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  library: MediaView[];
  onLibraryChange: (next: MediaView[]) => void;
  selected: string[];
  onChange: (ids: string[]) => void;
  max: number;
}) {
  const [busy, setBusy] = React.useState(false);
  const [problems, setProblems] = React.useState<string[]>([]);
  const libRef = React.useRef(library);
  React.useEffect(() => {
    libRef.current = library;
  });

  async function add(files: File[]) {
    if (libRef.current.length + files.length > MEDIA_FILES_MAX) setProblems([`Your library holds up to ${MEDIA_FILES_MAX} images.`]);
    setBusy(true);
    setProblems([]);
    const added: string[] = [];
    const out = await uploadMany(files, (m) => {
      libRef.current = addToLibrary(libRef.current, m);
      onLibraryChange(libRef.current);
      added.push(m.id);
    });
    setProblems(out);
    const room = max - selected.length;
    if (added.length && room > 0) onChange([...selected, ...added.filter((id) => !selected.includes(id)).slice(0, room)]);
    setBusy(false);
  }

  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : selected.length >= max ? selected : [...selected, id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] gap-0 overflow-hidden p-0 sm:max-w-2xl" showCloseButton={false}>
        <div className="border-b px-5 pt-5 pb-4">
          <DialogTitle className="font-heading text-lg font-extrabold">Add images</DialogTitle>
          <DialogDescription className="mt-1 text-[0.82rem] text-muted-foreground">
            Pick from your media library or upload new images (JPEG, PNG or WebP, up to 5 MB each). Up to {max} per post.
          </DialogDescription>
        </div>
        <div className="max-h-[56dvh] overflow-y-auto px-5 py-4">
          {problems.length ? (
            <ul role="alert" className="mb-3 space-y-1 rounded-2xl bg-destructive/[0.07] px-4 py-3 text-[0.82rem] font-medium text-destructive">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
          {library.length ? (
            <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4" aria-label="Media library">
              {library.map((m) => {
                const on = selected.includes(m.id);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(m.id)}
                      className={cn("group relative block aspect-square w-full overflow-hidden rounded-xl border bg-muted outline-none focus-visible:ring-3 focus-visible:ring-primary/40", on && "ring-2 ring-primary")}
                    >
                      <MediaThumb id={m.id} name={m.name} />
                      <span className="sr-only">{m.name}{on ? " (selected)" : ""}</span>
                      {on ? (
                        <span className="absolute end-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground shadow">
                          <Check className="size-3.5" aria-hidden />
                        </span>
                      ) : null}
                    </button>
                    <p className="mt-1 truncate text-[0.7rem] text-muted-foreground" aria-hidden>
                      {m.name}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Your media library is empty. Upload an image to get started.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3.5">
          <UploadButton onFiles={add} busy={busy} />
          <div className="flex items-center gap-3">
            <span className="text-[0.78rem] text-muted-foreground" aria-live="polite">
              {selected.length} of {max} selected
            </span>
            <button type="button" className={quietButton} onClick={() => onOpenChange(false)}>
              Done
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { formatBytes };
