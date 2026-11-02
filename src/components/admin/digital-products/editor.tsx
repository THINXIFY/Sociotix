"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArrowDown, ArrowLeft, ArrowUp, CircleAlert, Copy, Download, Eye, FileArchive, Globe, Link2, LoaderCircle, Plus, Save, Send, Star, Trash2, Undo2, Upload } from "lucide-react";
import { NewCategoryDialog, useCategories } from "@/components/admin/blog/categories";
import { CHECK_ICON, Chips, Counter } from "@/components/admin/blog/editor";
import { ImageField, ImageSource } from "@/components/admin/blog/image-field";
import { RichEditor } from "@/components/admin/blog/rich-editor";
import { blogApi, ConfirmDialog } from "@/components/admin/blog/shared";
import { slugify } from "@/lib/blog/admin";
import type { PostImage } from "@/lib/blog/admin";
import { effectiveSeoTitle, SEO_LIMITS, type SeoKind, seoChecklist, wordCount } from "@/lib/blog/seo-check";
import { PRODUCT_TYPES } from "@/lib/digital-products";
import { type AdminProduct, CURRENCIES, DOWNLOADABLE_TYPES, type DownloadLink, formatBytes, type ImageRef, LICENSE_TYPES, linkProvider, MAX_PRODUCT_FILE_BYTES, type ProductFields, type ProductFile } from "@/lib/digital-products/admin";
import { formatDateTime } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Field, SelectInput, TextArea, TextInput } from "../form";
import { Card, CardHeader } from "../ui";
import { PRODUCT_CATEGORY_SCOPE, ProductStatusBadge } from "./shared";

/* Admin → Digital Products → New / Edit. Two columns: the product on the left, publishing, pricing and files on the right. */

const PRODUCT_SEO: SeoKind = { titleSuffix: " | Sociotix", minWords: 150, noun: "product" };
const SLUG_MAX = 80;

const EMPTY: ProductFields = {
  title: "",
  slug: "",
  shortDescription: "",
  content: [],
  category: "social-templates",
  productType: "Template",
  tags: [],
  pricing: "unset",
  priceCents: null,
  currency: "USD",
  availability: "coming_soon",
  featured: false,
  featuredImageId: null,
  featuredImageAlt: "",
  gallery: [],
  includes: [],
  highlights: [],
  specifications: [],
  compatibility: [],
  requirements: [],
  licenseType: "",
  usageTerms: "",
  downloadLinks: [],
  focusKeyword: "",
  keywords: [],
  seoTitle: "",
  metaDescription: "",
  socialTitle: "",
  socialDescription: "",
  socialImageId: null,
};

const fieldsOf = (p: AdminProduct): ProductFields => {
  const f = {} as Record<string, unknown>;
  for (const k of Object.keys(EMPTY)) f[k] = p[k as keyof ProductFields];
  return f as unknown as ProductFields;
};
const toImage = (r: ImageRef | null): PostImage | null => (r ? { id: r.mediaId, src: r.src, width: r.width, height: r.height, mime: r.mime } : null);

type ApiError = Error & { field?: string; status?: number };
const linkId = () => Math.random().toString(36).slice(2, 14).padEnd(8, "0");
const isHttps = (v: string) => {
  try {
    return new URL(v.trim()).protocol === "https:";
  } catch {
    return false;
  }
};

/** One item per line (for contents, highlights, specifications, compatibility and requirements). */
function LinesField({ id, label, help, values, onChange, max, placeholder, error }: { id: string; label: string; help: string; values: string[]; onChange: (v: string[]) => void; max: number; placeholder: string; error?: string | null }) {
  const [text, setText] = React.useState(values.join("\n"));
  // Follow outside changes (a save normalising the list) without fighting the person typing.
  const joined = values.join("\n");
  const [seen, setSeen] = React.useState(joined);
  if (joined !== seen) {
    setSeen(joined);
    if (text.split("\n").map((x) => x.trim()).filter(Boolean).join("\n") !== joined) setText(joined);
  }
  const count = text.split("\n").filter((x) => x.trim()).length;
  return (
    <Field id={id} label={<span className="flex w-full items-center justify-between gap-3">{label} <span className={cn("text-xs font-semibold tabular-nums", count > max ? "text-destructive" : "text-muted-foreground")}>{count}/{max}</span></span>} help={help} error={error}>
      <TextArea
        id={id}
        rows={Math.min(8, Math.max(3, count + 1))}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value.split("\n").map((x) => x.trim()).filter(Boolean));
        }}
        aria-invalid={error ? true : undefined}
      />
    </Field>
  );
}

/** Product images after the featured one: add, describe, reorder and remove. */
function GalleryManager({ items, images, onChange, onImage, error }: { items: ProductFields["gallery"]; images: Map<string, PostImage>; onChange: (v: ProductFields["gallery"]) => void; onImage: (img: PostImage) => void; error?: string | null }) {
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div id="product-gallery" tabIndex={-1} className="space-y-4 outline-none">
      {items.length ? (
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((g, i) => {
            const img = images.get(g.mediaId);
            return (
              <li key={g.mediaId} className="overflow-hidden rounded-xl border bg-muted/20">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element -- uploaded image preview
                  <img src={img.src} alt={g.alt || `Gallery image ${i + 1}`} width={img.width} height={img.height} className="aspect-[16/10] w-full object-cover" />
                ) : (
                  <div className="grid aspect-[16/10] place-items-center text-xs text-muted-foreground">Image {i + 1}</div>
                )}
                <div className="space-y-2 p-3">
                  <label htmlFor={`gallery-alt-${g.mediaId}`} className="text-xs font-semibold">
                    Alt text · image {i + 1}
                  </label>
                  <TextInput id={`gallery-alt-${g.mediaId}`} value={g.alt} maxLength={200} placeholder="Describe what this image shows" onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} aria-invalid={error && !g.alt ? true : undefined} />
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move image ${i + 1} earlier`} className="grid size-8 place-items-center rounded-full hover:bg-muted disabled:opacity-40">
                      <ArrowUp className="size-4" aria-hidden />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move image ${i + 1} later`} className="grid size-8 place-items-center rounded-full hover:bg-muted disabled:opacity-40">
                      <ArrowDown className="size-4" aria-hidden />
                    </button>
                    <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="ms-auto inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-destructive hover:bg-destructive/10">
                      <Trash2 className="size-3.5" aria-hidden /> Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">No gallery images yet. Add screenshots or previews that show what the product contains.</p>
      )}
      {items.length < 12 ? (
        <ImageSource
          id="product-gallery-add"
          compact
          onAdded={(img) => {
            onImage(img);
            if (!items.some((x) => x.mediaId === img.id)) onChange([...items, { mediaId: img.id, alt: "" }]);
          }}
        />
      ) : (
        <p className="text-xs text-muted-foreground">The gallery is full (12 images).</p>
      )}
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** External download links (Google Drive, Dropbox, OneDrive…). Stored privately; never shown on public pages. */
function LinksEditor({ links, onChange, error }: { links: DownloadLink[]; onChange: (v: DownloadLink[]) => void; error?: string | null }) {
  const set = (i: number, patch: Partial<DownloadLink>) => onChange(links.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <div id="product-downloadLinks" tabIndex={-1} className="space-y-3 outline-none">
      {links.map((l, i) => {
        const provider = linkProvider(l.url);
        const bad = l.url.trim() !== "" && !isHttps(l.url);
        return (
          <fieldset key={l.id} className="space-y-3 rounded-xl border p-3.5">
            <legend className="px-1 text-xs font-semibold text-muted-foreground">
              Link {i + 1}
              {provider ? ` · ${provider}` : ""}
            </legend>
            <Field id={`link-url-${l.id}`} label="Download URL" error={bad ? "Use a full https:// address." : null}>
              <TextInput id={`link-url-${l.id}`} type="url" inputMode="url" value={l.url} maxLength={2000} placeholder="https://drive.google.com/…" onChange={(e) => set(i, { url: e.target.value })} aria-invalid={bad ? true : undefined} />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field id={`link-label-${l.id}`} label="Button label">
                <TextInput id={`link-label-${l.id}`} value={l.label} maxLength={40} placeholder="Download" onChange={(e) => set(i, { label: e.target.value })} />
              </Field>
              <Field id={`link-title-${l.id}`} label="Title" optional>
                <TextInput id={`link-title-${l.id}`} value={l.title} maxLength={120} placeholder="e.g. Canva template folder" onChange={(e) => set(i, { title: e.target.value })} />
              </Field>
            </div>
            <Field id={`link-instructions-${l.id}`} label="Instructions" optional>
              <TextArea id={`link-instructions-${l.id}`} rows={2} value={l.instructions} maxLength={500} placeholder="e.g. Open the link, then choose File → Make a copy." onChange={(e) => set(i, { instructions: e.target.value })} />
            </Field>
            <button type="button" onClick={() => onChange(links.filter((_, j) => j !== i))} className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-destructive hover:bg-destructive/10">
              <Trash2 className="size-3.5" aria-hidden /> Remove link
            </button>
          </fieldset>
        );
      })}
      {links.length < 10 ? (
        <button type="button" onClick={() => onChange([...links, { id: linkId(), url: "", label: "Download", title: "", instructions: "" }])} className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-card px-3.5 text-sm font-semibold hover:bg-muted">
          <Link2 className="size-4" aria-hidden /> Add a download link
        </button>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <p className="text-xs leading-relaxed text-muted-foreground">Links are kept private. Visitors only reach them through Sociotix after the download check, and only for free, released products.</p>
    </div>
  );
}

/** Uploaded download files: stored privately and checked by their contents. Needs a saved product. */
function FilesPanel({ product, onVersion }: { product: AdminProduct | null; onVersion: (v: number) => void }) {
  const [files, setFiles] = React.useState<ProductFile[]>(product?.files ?? []);
  const [version, setVersion] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState<ProductFile | null>(null);
  const [editing, setEditing] = React.useState<{ id: string; value: string } | null>(null);
  if (!product) return <p className="text-sm text-muted-foreground">Save the draft first, then upload the product&apos;s files here.</p>;
  const base = `/api/admin/digital-products/${product.id}/files`;

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (file.size > MAX_PRODUCT_FILE_BYTES) return setError("Files can be up to 8 MB.");
    const form = new FormData();
    form.set("file", file);
    form.set("version", version);
    setBusy(true);
    try {
      const r = await blogApi<{ file: ProductFile; productVersion: number }>(base, { method: "POST", body: form });
      setFiles((xs) => [...xs, r.file]);
      setVersion("");
      onVersion(r.productVersion);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const saveVersion = async () => {
    if (!editing) return;
    setError(null);
    try {
      const r = await blogApi<{ file: ProductFile; productVersion: number }>(`${base}/${editing.id}`, { method: "PATCH", body: JSON.stringify({ version: editing.value }) });
      setFiles((xs) => xs.map((x) => (x.id === r.file.id ? r.file : x)));
      onVersion(r.productVersion);
      setEditing(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      const r = await blogApi<{ productVersion: number }>(`${base}/${removing.id}`, { method: "DELETE" });
      setFiles((xs) => xs.filter((x) => x.id !== removing.id));
      onVersion(r.productVersion);
      setRemoving(null);
    } catch (e) {
      setError((e as Error).message);
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {files.length ? (
        <ul className="divide-y rounded-xl border" aria-label="Uploaded files">
          {files.map((f) => (
            <li key={f.id} className="flex items-start gap-3 px-3 py-2.5">
              <FileArchive className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{f.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {DOWNLOADABLE_TYPES[f.mime] ?? f.mime} · {formatBytes(f.sizeBytes)}
                  {f.version ? ` · v${f.version}` : ""}
                </p>
                {editing?.id === f.id ? (
                  <div className="mt-2 flex gap-1.5">
                    <TextInput aria-label={`Version of ${f.filename}`} value={editing.value} maxLength={40} autoFocus onChange={(e) => setEditing({ id: f.id, value: e.target.value })} onKeyDown={(e) => (e.key === "Enter" ? (e.preventDefault(), void saveVersion()) : e.key === "Escape" ? setEditing(null) : undefined)} className="h-8 text-xs" />
                    <button type="button" onClick={saveVersion} className="h-8 shrink-0 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground">
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs font-semibold">
                    <button type="button" onClick={() => setEditing({ id: f.id, value: f.version })} className="text-primary hover:underline">
                      {f.version ? "Change version" : "Add version"}
                    </button>
                    <a href={`/api/digital-products/${product.slug}/files/${f.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                      <Download className="size-3" aria-hidden /> Download
                    </a>
                    <button type="button" onClick={() => setRemoving(f)} className="text-destructive hover:underline">
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <label htmlFor="product-file-version" className="sr-only">
          Version for the next upload (optional)
        </label>
        <TextInput id="product-file-version" value={version} maxLength={40} placeholder="Version (optional)" onChange={(e) => setVersion(e.target.value)} className="h-10" />
        <input id="product-file" type="file" accept=".zip,.pdf,.epub,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={(e) => (void upload(e.target.files?.[0]), (e.target.value = ""))} />
        <label htmlFor="product-file" className={cn("inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 has-focus-visible:ring-3", busy && "pointer-events-none opacity-60")}>
          {busy ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Upload className="size-4" aria-hidden />} Upload
        </label>
      </div>
      <p className="text-xs text-muted-foreground">ZIP, PDF, EPUB, PNG, JPEG or WebP, up to 8 MB each. Files are stored privately, never as public links.</p>
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <ConfirmDialog open={Boolean(removing)} busy={busy} danger title="Remove this file?" description={<>“{removing?.filename}” will be deleted. This can&apos;t be undone.</>} confirmLabel="Remove file" onConfirm={remove} onClose={() => setRemoving(null)} />
    </div>
  );
}

/** The price is typed in currency units; the API takes cents. */
function PriceInput({ cents, currency, onCents, error }: { cents: number | null; currency: string; onCents: (c: number | null) => void; error?: string | null }) {
  const [text, setText] = React.useState(cents ? String(cents / 100) : "");
  return (
    <Field id="product-priceCents" label={`Price (${currency})`} error={error}>
      <TextInput
        id="product-priceCents"
        inputMode="decimal"
        value={text}
        placeholder="e.g. 19"
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9.]/g, "");
          setText(v);
          const n = Number(v);
          onCents(v && Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null);
        }}
        aria-invalid={error ? true : undefined}
      />
    </Field>
  );
}

export function ProductEditor({ product: initial, siteUrl }: { product: AdminProduct | null; siteUrl: string }) {
  const router = useRouter();
  const [product, setProduct] = React.useState(initial);
  const [f, setF] = React.useState<ProductFields>(() => (initial ? fieldsOf(initial) : EMPTY));
  const [saved, setSaved] = React.useState(() => JSON.stringify(initial ? fieldsOf(initial) : EMPTY));
  const [slugTouched, setSlugTouched] = React.useState(Boolean(initial));
  const [images, setImages] = React.useState<{ featured: PostImage | null; social: PostImage | null }>({ featured: toImage(initial?.featuredImage ?? null), social: toImage(initial?.socialImage ?? null) });
  const [gallery, setGallery] = React.useState(() => new Map((initial?.galleryImages ?? []).map((g) => [g.mediaId, toImage(g)!])));
  const [busy, setBusy] = React.useState<null | "save" | "publish" | "unpublish" | "archive" | "delete" | "preview" | "duplicate">(null);
  const [error, setError] = React.useState<{ message: string; field?: string } | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<null | "delete" | "unpublish" | "archive">(null);
  const cats = useCategories(PRODUCT_CATEGORY_SCOPE);
  const [newCategory, setNewCategory] = React.useState(false);

  const set = <K extends keyof ProductFields>(k: K, v: ProductFields[K]) => setF((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(f) !== saved;
  const status = product?.status ?? "draft";
  const errFor = (field: string) => (error?.field === field ? error.message : null);

  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const onTitle = (title: string) => setF((x) => ({ ...x, title, ...(slugTouched ? {} : { slug: slugify(title).slice(0, SLUG_MAX).replace(/-+$/, "") }) }));
  const fail = (e: unknown) => {
    const err = e as ApiError;
    setError({ message: err.message, field: err.field });
    setNotice(null);
    if (err.field) document.getElementById(`product-${err.field}`)?.focus();
  };

  /** Saves the current fields (creating the product the first time). Returns the saved product. */
  const save = async (): Promise<AdminProduct | null> => {
    setError(null);
    try {
      const body = JSON.stringify(product ? { ...f, version: product.version } : f);
      const { product: next } = product ? await blogApi<{ product: AdminProduct }>(`/api/admin/digital-products/${product.id}`, { method: "PATCH", body }) : await blogApi<{ product: AdminProduct }>("/api/admin/digital-products", { method: "POST", body });
      setProduct(next);
      const nf = fieldsOf(next);
      setF(nf);
      setSaved(JSON.stringify(nf));
      if (!product) window.history.replaceState(null, "", `/admin/digital-products/${next.id}/edit`);
      return next;
    } catch (e) {
      fail(e);
      return null;
    }
  };

  const doSave = async () => {
    setBusy("save");
    const p = await save();
    if (p) setNotice(p.status === "published" ? "Changes saved and live on the marketplace." : "Draft saved.");
    setBusy(null);
  };

  const preview = async () => {
    setBusy("preview");
    // Opened synchronously so the browser doesn't block it as a pop-up.
    const tab = window.open("about:blank", "_blank");
    const p = dirty || !product ? await save() : product;
    if (p && tab) tab.location.href = `/admin/digital-products/${p.id}/preview`;
    else tab?.close();
    setBusy(null);
  };

  const publish = async () => {
    setBusy("publish");
    const p = dirty || !product ? await save() : product;
    if (p) {
      try {
        const { product: next } = await blogApi<{ product: AdminProduct }>(`/api/admin/digital-products/${p.id}/publish`, { method: "POST", body: JSON.stringify({ version: p.version }) });
        setProduct(next);
        setNotice("Published. The product is live on the marketplace. Purchasing is still closed.");
      } catch (e) {
        fail(e);
      }
    }
    setBusy(null);
  };

  const duplicate = async () => {
    if (!product) return;
    setBusy("duplicate");
    try {
      const { product: copy } = await blogApi<{ product: AdminProduct }>(`/api/admin/digital-products/${product.id}/duplicate`, { method: "POST", body: "{}" });
      setSaved(JSON.stringify(f));
      router.push(`/admin/digital-products/${copy.id}/edit`);
    } catch (e) {
      fail(e);
      setBusy(null);
    }
  };

  const confirmAction = async () => {
    if (!product || !confirm) return;
    setBusy(confirm);
    setError(null);
    try {
      if (confirm === "delete") {
        await blogApi(`/api/admin/digital-products/${product.id}`, { method: "DELETE", body: JSON.stringify({ version: product.version }) });
        setSaved(JSON.stringify(f));
        router.push("/admin/digital-products");
        return;
      }
      const { product: next } = await blogApi<{ product: AdminProduct }>(`/api/admin/digital-products/${product.id}/${confirm}`, { method: "POST", body: JSON.stringify({ version: product.version }) });
      setProduct(next);
      setNotice(confirm === "archive" ? "Archived. The product is hidden from the marketplace." : "The product is a draft again and no longer on the marketplace.");
      setConfirm(null);
    } catch (e) {
      fail(e);
      setConfirm(null);
    } finally {
      setBusy(null);
    }
  };

  // Ctrl/Cmd+S saves.
  const saveRef = React.useRef(doSave);
  React.useEffect(() => {
    saveRef.current = doSave;
  });
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onContent = React.useCallback((content: ProductFields["content"]) => setF((x) => (JSON.stringify(x.content) === JSON.stringify(content) ? x : { ...x, content })), []);

  const seoTitle = effectiveSeoTitle(f.title, f.seoTitle, PRODUCT_SEO.titleSuffix);
  const desc = f.metaDescription || f.shortDescription;
  const checks = seoChecklist({ title: f.title, seoTitle: f.seoTitle, slug: f.slug, metaDescription: desc, focusKeyword: f.focusKeyword, blocks: f.content, hasImage: Boolean(f.featuredImageId), imageAlt: f.featuredImageAlt, category: f.category }, PRODUCT_SEO);
  const goodCount = checks.filter((c) => c.state === "good").length;
  const url = `${siteUrl}${f.slug || "your-product-url"}`;
  const words = wordCount(f.content);
  const isBusy = busy !== null;

  return (
    <div className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/digital-products" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> All products
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {dirty ? "Unsaved changes" : product ? `Saved ${formatDateTime(product.updatedAt)}` : "Not saved yet"}
          </span>
          <button type="button" onClick={preview} disabled={isBusy} className="inline-flex h-10 items-center gap-2 rounded-full border bg-card px-4 text-sm font-semibold hover:bg-muted disabled:opacity-60">
            {busy === "preview" ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Eye className="size-4" aria-hidden />} Preview
          </button>
          <button type="button" onClick={doSave} disabled={isBusy || (!dirty && Boolean(product))} className="inline-flex h-10 items-center gap-2 rounded-full border bg-card px-4 text-sm font-semibold hover:bg-muted disabled:opacity-60">
            {busy === "save" ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Save className="size-4" aria-hidden />} {status === "published" ? "Save changes" : "Save draft"}
          </button>
        </div>
      </div>

      <h1 className="sr-only">{product ? `Edit product: ${product.title}` : "New product"}</h1>

      {error ? (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <span className="font-medium">{error.message}</span>
        </div>
      ) : notice ? (
        <p role="status" className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-ok/25 bg-ok-soft px-4 py-2.5 text-sm font-medium text-ok">
          {notice}
          <button type="button" onClick={() => setNotice(null)} className="text-xs font-semibold underline">
            Dismiss
          </button>
        </p>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <Card className="space-y-5 p-5 sm:p-6">
            <Field id="product-title" label="Product title" error={errFor("title")}>
              <TextInput id="product-title" value={f.title} maxLength={160} onChange={(e) => onTitle(e.target.value)} placeholder="A clear, specific product name" className="h-12 font-heading text-lg font-bold" aria-invalid={errFor("title") ? true : undefined} />
            </Field>
            <Field id="product-slug" label="URL slug" error={errFor("slug")} help={product?.status === "published" && f.slug !== product.slug ? "Changing a live product's URL breaks links to the old address." : "Lowercase letters, numbers and hyphens."}>
              <div className="flex items-stretch overflow-hidden rounded-xl border focus-within:border-primary/50 focus-within:ring-3 focus-within:ring-primary/15">
                <span className="hidden items-center border-e bg-muted/50 px-3 font-mono text-xs text-muted-foreground sm:flex">/digital-products/</span>
                <input
                  id="product-slug"
                  value={f.slug}
                  maxLength={SLUG_MAX}
                  onChange={(e) => (setSlugTouched(true), set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-")))}
                  onBlur={() => set("slug", slugify(f.slug).slice(0, SLUG_MAX).replace(/-+$/, ""))}
                  aria-invalid={errFor("slug") ? true : undefined}
                  className="h-10 min-w-0 flex-1 bg-background px-3 font-mono text-sm outline-none dark:bg-muted/30"
                />
                {slugTouched && f.title ? (
                  <button type="button" onClick={() => (setSlugTouched(false), set("slug", slugify(f.title).slice(0, SLUG_MAX).replace(/-+$/, "")))} className="border-s px-3 text-xs font-semibold text-primary hover:bg-secondary">
                    From title
                  </button>
                ) : null}
              </div>
            </Field>
            <Field id="product-shortDescription" label="Short description" error={errFor("shortDescription")} help="One or two sentences for the product card and the top of its page. Also used as the meta description if you don't write one.">
              <TextArea id="product-shortDescription" value={f.shortDescription} maxLength={300} rows={2} onChange={(e) => set("shortDescription", e.target.value)} aria-invalid={errFor("shortDescription") ? true : undefined} />
            </Field>
          </Card>

          <section aria-labelledby="content-label">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 id="content-label" className="text-sm font-semibold">
                Full description
              </h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {words} word{words === 1 ? "" : "s"}
              </span>
            </div>
            <div id="product-content" tabIndex={-1} className="outline-none">
              <RichEditor label="Product description" initial={f.content} onChange={onContent} invalid={Boolean(errFor("content"))} describedBy={errFor("content") ? "content-error" : undefined} />
            </div>
            {errFor("content") ? (
              <p id="content-error" role="alert" className="mt-1.5 text-xs font-medium text-destructive">
                {errFor("content")}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">Headings, bold, italic, links, lists and quotes. Pasted text keeps that formatting; anything else is removed.</p>
            )}
          </section>

          <Card className="p-5 sm:p-6" aria-labelledby="images-title">
            <CardHeader id="images-title" title="Images" description="The featured image leads the product card and page; gallery images follow it on the product page." />
            <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
              <div id="product-featuredImageAlt-wrap">
                <ImageField
                  id="product-featuredImage"
                  label="Featured image"
                  help="Shown on the product card and first in the gallery."
                  image={images.featured}
                  alt={f.featuredImageAlt}
                  onAlt={(v) => set("featuredImageAlt", v)}
                  altError={errFor("featuredImageAlt")}
                  onChange={(img) => (setImages((x) => ({ ...x, featured: img })), setF((x) => ({ ...x, featuredImageId: img?.id ?? null, ...(img ? {} : { featuredImageAlt: "" }) })))}
                />
              </div>
              <div>
                <p className="mb-3 text-sm font-semibold">
                  Gallery <span className="font-normal text-muted-foreground">· {f.gallery.length}/12</span>
                </p>
                <GalleryManager items={f.gallery} images={gallery} onChange={(v) => set("gallery", v)} onImage={(img) => setGallery((m) => new Map(m).set(img.id, img))} error={errFor("gallery")} />
              </div>
            </div>
          </Card>

          <Card className="space-y-5 p-5 sm:p-6" aria-labelledby="details-title">
            <CardHeader id="details-title" title="What's inside" description="One item per line. Only what the product really contains; empty sections don't appear on the page." />
            <LinesField id="product-includes" label="Contents" help="What the buyer gets, e.g. “30 editable Canva templates”." values={f.includes} onChange={(v) => set("includes", v)} max={30} placeholder={"30 editable post templates\nLight and dark colourways"} error={errFor("includes")} />
            <LinesField id="product-highlights" label="Highlights" help="The main reasons it's useful." values={f.highlights} onChange={(v) => set("highlights", v)} max={12} placeholder="Ready to edit in minutes" error={errFor("highlights")} />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <LinesField id="product-specifications" label="Specifications" help="Sizes, page counts, formats." values={f.specifications} onChange={(v) => set("specifications", v)} max={20} placeholder="1080 × 1350 px" error={errFor("specifications")} />
              <LinesField id="product-compatibility" label="Compatibility" help="Apps or tools it works with." values={f.compatibility} onChange={(v) => set("compatibility", v)} max={20} placeholder="Canva (free plan)" error={errFor("compatibility")} />
              <LinesField id="product-requirements" label="Requirements" help="Anything needed to use it." values={f.requirements} onChange={(v) => set("requirements", v)} max={20} placeholder="A Canva account" error={errFor("requirements")} />
            </div>
          </Card>

          <Card className="p-5 sm:p-6" aria-labelledby="downloads-title">
            <CardHeader id="downloads-title" title="Files & download links" description="Uploaded files and external links for this product. Both stay private and are only released by the download check." />
            <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div>
                <p className="mb-3 text-sm font-semibold">Uploaded files</p>
                <FilesPanel key={product?.id ?? "new"} product={product} onVersion={(v) => setProduct((p) => (p ? { ...p, version: v } : p))} />
              </div>
              <div>
                <p className="mb-3 text-sm font-semibold">External download links</p>
                <LinksEditor links={f.downloadLinks} onChange={(v) => set("downloadLinks", v)} error={errFor("downloadLinks")} />
              </div>
            </div>
          </Card>

          <Card className="p-5 sm:p-6" aria-labelledby="seo-title">
            <CardHeader id="seo-title" title="SEO settings" description="How the product appears in search results and when shared." />
            <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field id="product-focusKeyword" label="Focus keyword" help="The main thing people search for.">
                    <TextInput id="product-focusKeyword" value={f.focusKeyword} maxLength={80} onChange={(e) => set("focusKeyword", e.target.value)} placeholder="e.g. instagram carousel templates" />
                  </Field>
                  <Field id="product-keywords" label="Additional keywords" optional>
                    <Chips id="product-keywords" values={f.keywords} onChange={(v) => set("keywords", v)} max={10} maxLength={60} placeholder="Add and press Enter" />
                  </Field>
                </div>
                <Field id="product-seoTitle" label={<span className="flex w-full items-center justify-between gap-3">SEO title <Counter value={seoTitle.length} min={SEO_LIMITS.title.min} max={SEO_LIMITS.title.max} /></span>} help={`Leave empty to use “${f.title || "Product title"} | Sociotix”.`}>
                  <TextInput id="product-seoTitle" value={f.seoTitle} maxLength={120} onChange={(e) => set("seoTitle", e.target.value)} placeholder={seoTitle || "SEO title"} />
                </Field>
                <Field id="product-metaDescription" label={<span className="flex w-full items-center justify-between gap-3">Meta description <Counter value={desc.length} min={SEO_LIMITS.description.min} max={SEO_LIMITS.description.max} /></span>} help="Leave empty to use the short description.">
                  <TextArea id="product-metaDescription" value={f.metaDescription} maxLength={320} rows={3} onChange={(e) => set("metaDescription", e.target.value)} placeholder={f.shortDescription || "What the product is and who it's for, in one or two sentences."} />
                </Field>

                <div>
                  <p className="text-sm font-semibold">Search result preview</p>
                  <div className="mt-2 rounded-xl border bg-white p-4 text-start dark:bg-[#202124]" aria-label="Google search result preview">
                    <p className="truncate text-[0.8rem] text-[#202124] dark:text-[#dadce0]">{url.replace(/^https?:\/\//, "").replace(/\//g, " › ")}</p>
                    <p className="mt-1 line-clamp-1 text-[1.15rem] leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">{seoTitle || "Your product title"}</p>
                    <p className="mt-1 line-clamp-2 text-[0.85rem] leading-relaxed text-[#4d5156] dark:text-[#bdc1c6]">{desc || "Add a meta description to control the text shown under the title."}</p>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">An approximation: search engines may choose different text.</p>
                </div>

                <div className="space-y-4 border-t pt-5">
                  <p className="text-sm font-semibold">Social sharing</p>
                  <Field id="product-socialTitle" label="Social title" optional>
                    <TextInput id="product-socialTitle" value={f.socialTitle} maxLength={120} onChange={(e) => set("socialTitle", e.target.value)} placeholder={f.title || "Defaults to the product title"} />
                  </Field>
                  <Field id="product-socialDescription" label="Social description" optional>
                    <TextArea id="product-socialDescription" value={f.socialDescription} maxLength={320} rows={2} onChange={(e) => set("socialDescription", e.target.value)} placeholder={desc || "Defaults to the meta description"} />
                  </Field>
                  <ImageField id="product-socialImage" label="Social image" help="Defaults to the featured image. JPEG or PNG are shared as-is; other images use the branded card." image={images.social} onChange={(img) => (setImages((x) => ({ ...x, social: img })), set("socialImageId", img?.id ?? null))} />
                </div>
                <div className="rounded-xl bg-muted/40 px-3.5 py-3 text-xs">
                  <p className="font-semibold">Canonical URL</p>
                  <p className="mt-0.5 font-mono break-all text-muted-foreground">{url}</p>
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-semibold">SEO checklist</p>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {goodCount}/{checks.length}
                  </span>
                </div>
                <ul className="mt-2 space-y-2" aria-label="SEO checklist">
                  {checks.map((c) => {
                    const { Icon, className, label } = CHECK_ICON[c.state];
                    return (
                      <li key={c.id} className="flex items-start gap-2 rounded-lg border px-3 py-2">
                        <Icon className={cn("mt-0.5 size-4 shrink-0", className)} aria-label={label} />
                        <span className="min-w-0">
                          <span className="block text-[0.82rem] font-semibold">{c.label}</span>
                          <span className="block text-xs leading-relaxed text-muted-foreground">{c.hint}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Suggestions based on the Sociotix SEO standards, not a ranking score. Nothing here changes your product automatically.</p>
              </div>
            </div>
          </Card>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start" aria-label="Product settings">
          <Card className="p-5" aria-labelledby="publish-title">
            <CardHeader id="publish-title" title="Publish" action={<ProductStatusBadge status={status} />} />
            {status === "published" && product?.publishedAt ? (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Globe className="size-4" aria-hidden /> Live since {formatDateTime(product.publishedAt, { year: true })}
              </p>
            ) : status === "archived" ? (
              <p className="mt-3 text-sm text-muted-foreground">Archived: kept for your records, hidden from the marketplace.</p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Drafts are private: not on the marketplace, the sitemap or search engines.</p>
            )}
            <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">Publishing shows the product on the marketplace. It doesn&apos;t enable purchases: paid products can&apos;t be bought or downloaded yet.</p>
            <div className="mt-4 grid gap-2">
              {status !== "published" ? (
                <button type="button" onClick={publish} disabled={isBusy} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_12px_28px_-14px_rgb(112_71_235/0.9)] hover:bg-primary/90 disabled:opacity-60">
                  {busy === "publish" ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Send className="size-4" aria-hidden />} Publish
                </button>
              ) : (
                <a href={`/digital-products/${product!.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold hover:bg-muted">
                  <Globe className="size-4" aria-hidden /> View on marketplace
                </a>
              )}
              {product && status === "published" ? (
                <button type="button" onClick={() => setConfirm("unpublish")} disabled={isBusy} className="inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60">
                  <Undo2 className="size-4" aria-hidden /> Unpublish
                </button>
              ) : null}
              {product ? (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={duplicate} disabled={isBusy} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60">
                    <Copy className="size-4" aria-hidden /> Duplicate
                  </button>
                  {status !== "archived" ? (
                    <button type="button" onClick={() => setConfirm("archive")} disabled={isBusy} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60">
                      <Archive className="size-4" aria-hidden /> Archive
                    </button>
                  ) : null}
                </div>
              ) : null}
              {product ? (
                <button type="button" onClick={() => setConfirm("delete")} disabled={isBusy} className="inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60">
                  <Trash2 className="size-4" aria-hidden /> Delete product
                </button>
              ) : null}
            </div>
          </Card>

          <Card className="space-y-5 p-5" aria-labelledby="pricing-title">
            <CardHeader id="pricing-title" title="Pricing & availability" />
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold">Price</legend>
              <div className="space-y-2">
                {(
                  [
                    ["free", "Free"],
                    ["paid", "Paid"],
                    ["unset", "Not decided yet"],
                  ] as const
                ).map(([v, label]) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="radio" name="pricing" checked={f.pricing === v} onChange={() => setF((x) => ({ ...x, pricing: v, ...(v === "paid" ? {} : { priceCents: null }) }))} className="size-4 accent-primary" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            {f.pricing === "paid" ? (
              <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
                <PriceInput key={`${product?.id ?? "new"}-${f.currency}`} cents={f.priceCents} currency={f.currency} onCents={(c) => set("priceCents", c)} error={errFor("priceCents")} />
                <Field id="product-currency" label="Currency">
                  <SelectInput id="product-currency" value={f.currency} onChange={(e) => set("currency", e.target.value)} className="h-10">
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
            ) : null}
            {f.pricing === "paid" ? <p className="text-xs leading-relaxed text-muted-foreground">Shown as the price. Purchasing isn&apos;t open, so nobody can buy or download a paid product yet.</p> : null}
            <Field id="product-availability" label="Availability" help={f.availability === "available" ? (f.pricing === "free" ? "Released: signed-in visitors can download its files and links." : "Released, but only free products can be downloaded.") : "Shows “Coming soon” and a Notify Me button."}>
              <SelectInput id="product-availability" value={f.availability} onChange={(e) => set("availability", e.target.value as ProductFields["availability"])} className="h-10">
                <option value="coming_soon">Coming soon</option>
                <option value="available">Released</option>
              </SelectInput>
            </Field>
          </Card>

          <Card className="space-y-5 p-5" aria-labelledby="organise-title">
            <CardHeader id="organise-title" title="Organise" />
            <div>
              <Field id="product-category" label="Category" error={errFor("category")}>
                <SelectInput id="product-category" value={f.category} onChange={(e) => set("category", e.target.value)} className="h-10">
                  {cats.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <button type="button" onClick={() => setNewCategory(true)} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                <Plus className="size-3" aria-hidden /> New category
              </button>
              <NewCategoryDialog scope={PRODUCT_CATEGORY_SCOPE} open={newCategory} onClose={() => setNewCategory(false)} onAdded={(c) => (cats.add(c), set("category", c.id))} />
            </div>
            <Field id="product-productType" label="Product type" error={errFor("productType")}>
              <SelectInput id="product-productType" value={f.productType} onChange={(e) => set("productType", e.target.value as ProductFields["productType"])} className="h-10">
                {PRODUCT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id="product-tags" label="Tags" optional help="Up to 12. Press Enter or comma to add.">
              <Chips id="product-tags" values={f.tags} onChange={(v) => set("tags", v)} max={12} maxLength={40} placeholder="Add a tag" />
            </Field>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input type="checkbox" checked={f.featured} onChange={(e) => set("featured", e.target.checked)} className="mt-0.5 size-4 accent-primary" />
              <span>
                <span className="flex items-center gap-1 font-semibold">
                  <Star className="size-3.5 text-soon" aria-hidden /> Feature on the marketplace
                </span>
                <span className="block text-xs text-muted-foreground">Shown in “Featured” at the top of the marketplace.</span>
              </span>
            </label>
          </Card>

          <Card className="space-y-5 p-5" aria-labelledby="license-title">
            <CardHeader id="license-title" title="License" />
            <Field id="product-licenseType" label="License type">
              <SelectInput id="product-licenseType" value={f.licenseType} onChange={(e) => set("licenseType", e.target.value)} className="h-10">
                {LICENSE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t || "Not specified"}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id="product-usageTerms" label="Usage terms" optional help="What buyers may and may not do with it.">
              <TextArea id="product-usageTerms" rows={4} value={f.usageTerms} maxLength={2000} onChange={(e) => set("usageTerms", e.target.value)} placeholder="e.g. Use in your own and client projects. Don't resell or share the files." />
            </Field>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        busy={busy === "delete" || busy === "unpublish" || busy === "archive"}
        danger={confirm === "delete"}
        title={confirm === "delete" ? "Delete this product?" : confirm === "archive" ? "Archive this product?" : "Unpublish this product?"}
        description={
          confirm === "delete" ? (
            <>“{product?.title}” and its uploaded files will be permanently deleted{status === "published" ? " and its page will stop working" : ""}. This can&apos;t be undone.</>
          ) : confirm === "archive" ? (
            <>“{product?.title}” will be hidden from the marketplace{status === "published" ? " and its page will stop working" : ""}. You can publish it again later.</>
          ) : (
            <>“{product?.title}” will become a private draft and leave the marketplace, the sitemap and search results.</>
          )
        }
        confirmLabel={confirm === "delete" ? "Delete product" : confirm === "archive" ? "Archive" : "Unpublish"}
        onConfirm={confirmAction}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
