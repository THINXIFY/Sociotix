"use client";

import * as React from "react";
import { ImagePlus, Link2, LoaderCircle, RefreshCw, Trash2, Upload } from "lucide-react";
import type { PostImage } from "@/lib/blog/admin";
import { cn } from "@/lib/utils";
import { Field, TextInput } from "../form";
import { blogApi } from "./shared";

/* Image upload / import used by the featured image, the social image and images inside the post. */

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX = 5 * 1024 * 1024;

/** Upload from this device or import a public image link; the server validates and stores either. */
export function ImageSource({ id, onAdded, compact }: { id: string; onAdded: (img: PostImage) => void; compact?: boolean }) {
  const [mode, setMode] = React.useState<"upload" | "url">("upload");
  const [url, setUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [drag, setDrag] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const send = async (body: FormData | string) => {
    setBusy(true);
    setError(null);
    try {
      const { image } = await blogApi<{ image: PostImage }>("/api/admin/blog/media", { method: "POST", body });
      setUrl("");
      onAdded(image);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That image couldn't be added.");
    } finally {
      setBusy(false);
    }
  };
  const upload = (file: File | undefined) => {
    if (!file) return;
    if (!TYPES.includes(file.type)) return setError("Use a JPEG, PNG or WebP image.");
    if (file.size > MAX) return setError("Images can be up to 5 MB.");
    const form = new FormData();
    form.set("file", file);
    void send(form);
  };

  return (
    <div className="space-y-2.5">
      <div role="tablist" aria-label="Image source" className="inline-flex gap-1 rounded-xl bg-muted p-1">
        {(
          [
            ["upload", "Upload", Upload],
            ["url", "Image URL", Link2],
          ] as const
        ).map(([m, label, Icon]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => (setMode(m), setError(null))} className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[0.8rem] font-semibold text-muted-foreground transition-colors", mode === m && "bg-card text-foreground shadow-sm")}>
            <Icon className="size-3.5" aria-hidden /> {label}
          </button>
        ))}
      </div>
      {mode === "upload" ? (
        <div
          onDragOver={(e) => (e.preventDefault(), setDrag(true))}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            upload(e.dataTransfer.files[0]);
          }}
          className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed text-center transition-colors", compact ? "px-3 py-5" : "px-4 py-7", drag ? "border-primary bg-primary/[0.05]" : "bg-muted/30")}
        >
          {busy ? <LoaderCircle className="size-5 animate-spin text-primary motion-reduce:animate-none" aria-hidden /> : <ImagePlus className="size-5 text-primary" aria-hidden />}
          <p className="mt-2 text-sm font-semibold">{busy ? "Uploading…" : "Drop an image or choose a file"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">JPEG, PNG or WebP, up to 5 MB</p>
          <input ref={fileRef} id={`${id}-file`} type="file" accept={TYPES.join(",")} className="sr-only" onChange={(e) => (upload(e.target.files?.[0]), (e.target.value = ""))} />
          <label htmlFor={`${id}-file`} className={cn("mt-3 inline-flex h-9 cursor-pointer items-center rounded-full border bg-card px-4 text-sm font-semibold hover:bg-muted has-focus-visible:ring-3", busy && "pointer-events-none opacity-60")}>
            Choose file
          </label>
        </div>
      ) : (
        <div className="flex gap-2">
          <label htmlFor={`${id}-url`} className="sr-only">
            Image URL
          </label>
          <TextInput id={`${id}-url`} type="url" inputMode="url" placeholder="https://example.com/photo.jpg" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), url.trim() && void send(JSON.stringify({ url: url.trim() })))} />
          <button type="button" disabled={busy || !url.trim()} onClick={() => void send(JSON.stringify({ url: url.trim() }))} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {busy ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null} Import
          </button>
        </div>
      )}
      {mode === "url" ? <p className="text-xs text-muted-foreground">The image is copied to Sociotix, so the post never depends on the other site.</p> : null}
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A chosen image with preview, replace and remove, plus (optionally) its alt text. */
export function ImageField({
  id,
  label,
  help,
  image,
  onChange,
  alt,
  onAlt,
  altError,
}: {
  id: string;
  label: string;
  help?: string;
  image: PostImage | null;
  onChange: (img: PostImage | null) => void;
  alt?: string;
  onAlt?: (v: string) => void;
  altError?: string | null;
}) {
  const [replacing, setReplacing] = React.useState(false);
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold" id={`${id}-label`}>
          {label}
        </p>
        {image ? (
          <div className="flex gap-1">
            <button type="button" onClick={() => setReplacing((r) => !r)} className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-semibold text-primary hover:bg-secondary">
              <RefreshCw className="size-3.5" aria-hidden /> {replacing ? "Keep" : "Replace"}
            </button>
            <button type="button" onClick={() => (onChange(null), setReplacing(false))} className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-semibold text-destructive hover:bg-destructive/10">
              <Trash2 className="size-3.5" aria-hidden /> Remove
            </button>
          </div>
        ) : null}
      </div>
      {image ? (
        <div className="overflow-hidden rounded-xl border bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded image preview */}
          <img src={image.src} alt={alt || "Selected image"} width={image.width} height={image.height} className="aspect-[16/9] w-full object-cover" />
          <p className="border-t px-3 py-1.5 text-[0.7rem] text-muted-foreground">
            {image.width} × {image.height} · {image.mime.replace("image/", "").toUpperCase()}
          </p>
        </div>
      ) : null}
      {!image || replacing ? <ImageSource id={id} compact onAdded={(img) => (onChange(img), setReplacing(false))} /> : null}
      {image && onAlt ? (
        <Field id={`${id}-alt`} label="Alt text" error={altError} help="Describe what the image shows for screen readers and search engines.">
          <TextInput id={`${id}-alt`} value={alt ?? ""} maxLength={200} onChange={(e) => onAlt(e.target.value)} aria-invalid={altError ? true : undefined} aria-describedby={altError ? `${id}-alt-error` : `${id}-alt-help`} />
        </Field>
      ) : null}
      {help && !image ? <p className="text-xs text-muted-foreground">{help}</p> : null}
    </div>
  );
}
