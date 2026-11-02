"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, CircleAlert, CircleCheck, CircleDashed, Eye, Globe, LoaderCircle, Save, Send, Star, Trash2, Undo2, X } from "lucide-react";
import { type AdminPost, type PostFields, type PostImage, slugify, SLUG_MAX, TEAM_AUTHOR } from "@/lib/blog/admin";
import { type CheckState, effectiveSeoTitle, SEO_LIMITS, seoChecklist, wordCount } from "@/lib/blog/seo-check";
import { formatDateTime } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Field, inputClass, SelectInput, TextArea, TextInput } from "../form";
import { Card, CardHeader } from "../ui";
import { NewCategoryDialog, useCategories } from "./categories";
import { ImageField } from "./image-field";
import { RichEditor } from "./rich-editor";
import { blogApi, ConfirmDialog, PostStatus } from "./shared";

/* Admin → Blog Management → New / Edit post. Two columns: writing on the left, publishing and SEO on the right. */

const EMPTY: PostFields = {
  title: "",
  slug: "",
  excerpt: "",
  content: [],
  category: "guides",
  tags: [],
  featured: false,
  authorKind: "organization",
  authorName: TEAM_AUTHOR,
  featuredImageId: null,
  featuredImageAlt: "",
  focusKeyword: "",
  keywords: [],
  seoTitle: "",
  metaDescription: "",
  socialTitle: "",
  socialDescription: "",
  socialImageId: null,
};

const fieldsOf = (p: AdminPost): PostFields => {
  const f = {} as Record<string, unknown>;
  for (const k of Object.keys(EMPTY)) f[k] = p[k as keyof PostFields];
  return f as unknown as PostFields;
};

type ApiError = Error & { field?: string; status?: number };

export function Counter({ value, min, max }: { value: number; min: number; max: number }) {
  const tone = !value ? "text-muted-foreground" : value > max ? "text-destructive" : value < min ? "text-soon" : "text-ok";
  return (
    <span className={cn("text-xs font-semibold tabular-nums", tone)}>
      {value}/{max}
    </span>
  );
}

/** Small chip input for tags and keywords (Enter or comma adds). */
export function Chips({ id, values, onChange, max, maxLength, placeholder }: { id: string; values: string[]; onChange: (v: string[]) => void; max: number; maxLength: number; placeholder: string }) {
  const [draft, setDraft] = React.useState("");
  const add = () => {
    const v = draft.trim().replace(/,+$/, "");
    if (v && values.length < max && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v.slice(0, maxLength)]);
    setDraft("");
  };
  return (
    <div className={cn(inputClass, "flex min-h-10 flex-wrap items-center gap-1.5 px-2 py-1.5")}>
      {values.map((t) => (
        <span key={t} className="inline-flex h-7 items-center gap-1 rounded-full bg-secondary ps-2.5 pe-1 text-xs font-semibold text-secondary-foreground">
          {t}
          <button type="button" onClick={() => onChange(values.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="grid size-5 place-items-center rounded-full hover:bg-card">
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        maxLength={maxLength}
        disabled={values.length >= max}
        onChange={(e) => {
          setDraft(e.target.value);
          if (e.target.value.endsWith(",")) queueMicrotask(add);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
          if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={add}
        placeholder={values.length >= max ? `Up to ${max}` : placeholder}
        className="h-7 min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground/70"
      />
    </div>
  );
}

export const CHECK_ICON: Record<CheckState, { Icon: typeof CircleCheck; className: string; label: string }> = {
  good: { Icon: CircleCheck, className: "text-ok", label: "Good" },
  improve: { Icon: CircleAlert, className: "text-soon", label: "Could improve" },
  missing: { Icon: CircleDashed, className: "text-muted-foreground", label: "Missing" },
};

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export function BlogEditor({ post: initialPost, siteUrl, viewerName }: { post: AdminPost | null; siteUrl: string; viewerName: string }) {
  const router = useRouter();
  const [post, setPost] = React.useState(initialPost);
  const [f, setF] = React.useState<PostFields>(() => (initialPost ? fieldsOf(initialPost) : EMPTY));
  const [saved, setSaved] = React.useState(() => JSON.stringify(initialPost ? fieldsOf(initialPost) : EMPTY));
  const [slugTouched, setSlugTouched] = React.useState(Boolean(initialPost));
  const [images, setImages] = React.useState<{ featured: PostImage | null; social: PostImage | null }>({ featured: initialPost?.featuredImage ?? null, social: initialPost?.socialImage ?? null });
  const [busy, setBusy] = React.useState<null | "save" | "publish" | "unpublish" | "delete" | "preview">(null);
  const [error, setError] = React.useState<{ message: string; field?: string } | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [when, setWhen] = React.useState<"now" | "schedule">("now");
  const [scheduleAt, setScheduleAt] = React.useState(() => toLocalInput(new Date(Date.now() + 86_400_000)));
  const [confirm, setConfirm] = React.useState<null | "delete" | "unpublish">(null);
  const cats = useCategories();
  const [newCategory, setNewCategory] = React.useState(false);

  const set = <K extends keyof PostFields>(k: K, v: PostFields[K]) => setF((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(f) !== saved;
  const state = post?.state ?? "draft";
  const errFor = (field: string) => (error?.field === field ? error.message : null);

  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const onTitle = (title: string) => setF((x) => ({ ...x, title, ...(slugTouched ? {} : { slug: slugify(title) }) }));

  /** Saves the current fields (creating the post the first time). Returns the saved post. */
  const save = async (): Promise<AdminPost | null> => {
    setError(null);
    try {
      const body = JSON.stringify(post ? { ...f, version: post.version } : f);
      const { post: next } = post ? await blogApi<{ post: AdminPost }>(`/api/admin/blog/posts/${post.id}`, { method: "PATCH", body }) : await blogApi<{ post: AdminPost }>("/api/admin/blog/posts", { method: "POST", body });
      setPost(next);
      const nf = fieldsOf(next);
      setF(nf);
      setSaved(JSON.stringify(nf));
      if (!post) window.history.replaceState(null, "", `/admin/blog/${next.id}/edit`);
      return next;
    } catch (e) {
      const err = e as ApiError;
      setError({ message: err.message, field: err.field });
      if (err.field) document.getElementById(`post-${err.field}`)?.focus();
      return null;
    }
  };

  const doSave = async () => {
    setBusy("save");
    const p = await save();
    if (p) setNotice(p.state === "draft" ? "Draft saved." : "Changes saved and live.");
    setBusy(null);
  };

  const preview = async () => {
    setBusy("preview");
    // Opened synchronously so the browser doesn't block it as a pop-up.
    const tab = window.open("about:blank", "_blank");
    const p = dirty || !post ? await save() : post;
    if (p && tab) tab.location.href = `/admin/blog/${p.id}/preview`;
    else tab?.close();
    setBusy(null);
  };

  const publish = async () => {
    setBusy("publish");
    const p = dirty || !post ? await save() : post;
    if (p) {
      try {
        const publishAt = when === "schedule" ? new Date(scheduleAt).toISOString() : undefined;
        const { post: next } = await blogApi<{ post: AdminPost }>(`/api/admin/blog/posts/${p.id}/publish`, { method: "POST", body: JSON.stringify({ version: p.version, ...(publishAt ? { publishAt } : {}) }) });
        setPost(next);
        setNotice(next.state === "scheduled" ? `Scheduled for ${formatDateTime(next.publishedAt!, { year: true })}.` : "Published. The post is live on the blog.");
      } catch (e) {
        const err = e as ApiError;
        setError({ message: err.message, field: err.field });
      }
    }
    setBusy(null);
  };

  const confirmAction = async () => {
    if (!post || !confirm) return;
    setBusy(confirm);
    setError(null);
    try {
      if (confirm === "delete") {
        await blogApi(`/api/admin/blog/posts/${post.id}`, { method: "DELETE", body: JSON.stringify({ version: post.version }) });
        setSaved(JSON.stringify(f));
        router.push("/admin/blog");
        return;
      }
      const { post: next } = await blogApi<{ post: AdminPost }>(`/api/admin/blog/posts/${post.id}/unpublish`, { method: "POST", body: JSON.stringify({ version: post.version }) });
      setPost(next);
      setNotice("The post is a draft again and no longer on the blog.");
      setConfirm(null);
    } catch (e) {
      setError({ message: (e as Error).message });
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

  const onContent = React.useCallback((content: PostFields["content"]) => setF((x) => (JSON.stringify(x.content) === JSON.stringify(content) ? x : { ...x, content })), []);

  const seoTitle = effectiveSeoTitle(f.title, f.seoTitle);
  const desc = f.metaDescription || f.excerpt;
  const checks = seoChecklist({ title: f.title, seoTitle: f.seoTitle, slug: f.slug, metaDescription: f.metaDescription, focusKeyword: f.focusKeyword, blocks: f.content, hasImage: Boolean(f.featuredImageId), imageAlt: f.featuredImageAlt, category: f.category });
  const goodCount = checks.filter((c) => c.state === "good").length;
  const url = `${siteUrl}${f.slug || "your-post-url"}`;
  const words = wordCount(f.content);
  const isBusy = busy !== null;

  return (
    <div className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/blog" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> All posts
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {dirty ? "Unsaved changes" : post ? `Saved ${formatDateTime(post.updatedAt)}` : "Not saved yet"}
          </span>
          <button type="button" onClick={preview} disabled={isBusy} className="inline-flex h-10 items-center gap-2 rounded-full border bg-card px-4 text-sm font-semibold hover:bg-muted disabled:opacity-60">
            {busy === "preview" ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Eye className="size-4" aria-hidden />} Preview
          </button>
          <button type="button" onClick={doSave} disabled={isBusy || (!dirty && Boolean(post))} className="inline-flex h-10 items-center gap-2 rounded-full border bg-card px-4 text-sm font-semibold hover:bg-muted disabled:opacity-60">
            {busy === "save" ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Save className="size-4" aria-hidden />} {state === "draft" ? "Save draft" : "Save changes"}
          </button>
        </div>
      </div>

      <h1 className="sr-only">{post ? `Edit post: ${post.title}` : "New post"}</h1>

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
            <Field id="post-title" label="Title" error={errFor("title")}>
              <TextInput id="post-title" value={f.title} maxLength={160} onChange={(e) => onTitle(e.target.value)} placeholder="A clear, specific title" className="h-12 font-heading text-lg font-bold" aria-invalid={errFor("title") ? true : undefined} />
            </Field>
            <Field id="post-slug" label="URL slug" error={errFor("slug")} help={post?.state === "published" && f.slug !== post.slug ? "Changing a live post's URL keeps the old address working as a redirect." : "Lowercase letters, numbers and hyphens."}>
              <div className="flex items-stretch overflow-hidden rounded-xl border focus-within:border-primary/50 focus-within:ring-3 focus-within:ring-primary/15">
                <span className="hidden items-center border-e bg-muted/50 px-3 font-mono text-xs text-muted-foreground sm:flex">/blog/</span>
                <input
                  id="post-slug"
                  value={f.slug}
                  maxLength={SLUG_MAX}
                  onChange={(e) => (setSlugTouched(true), set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-")))}
                  onBlur={() => set("slug", slugify(f.slug))}
                  aria-invalid={errFor("slug") ? true : undefined}
                  className="h-10 min-w-0 flex-1 bg-background px-3 font-mono text-sm outline-none dark:bg-muted/30"
                />
                {slugTouched && f.title ? (
                  <button type="button" onClick={() => (setSlugTouched(false), set("slug", slugify(f.title)))} className="border-s px-3 text-xs font-semibold text-primary hover:bg-secondary">
                    From title
                  </button>
                ) : null}
              </div>
            </Field>
            <Field id="post-excerpt" label="Summary" error={errFor("excerpt")} help="One or two sentences shown on blog cards. Also used as the meta description if you don't write one.">
              <TextArea id="post-excerpt" value={f.excerpt} maxLength={300} rows={2} onChange={(e) => set("excerpt", e.target.value)} aria-invalid={errFor("excerpt") ? true : undefined} />
            </Field>
          </Card>

          <section aria-labelledby="content-label">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 id="content-label" className="text-sm font-semibold">
                Content
              </h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {words} word{words === 1 ? "" : "s"} · about {Math.max(1, Math.round(words / 220))} min read
              </span>
            </div>
            <RichEditor initial={f.content} onChange={onContent} invalid={Boolean(errFor("content"))} describedBy={errFor("content") ? "content-error" : undefined} />
            {errFor("content") ? (
              <p id="content-error" role="alert" className="mt-1.5 text-xs font-medium text-destructive">
                {errFor("content")}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">Pasted text keeps headings, lists, links and bold/italic; other formatting is removed.</p>
            )}
          </section>

          <Card className="p-5 sm:p-6" aria-labelledby="seo-title">
            <CardHeader id="seo-title" title="SEO settings" description="How the post appears in search results and when shared." />
            <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field id="post-focusKeyword" label="Focus keyword" help="The main topic people search for.">
                    <TextInput id="post-focusKeyword" value={f.focusKeyword} maxLength={80} onChange={(e) => set("focusKeyword", e.target.value)} placeholder="e.g. content calendar" />
                  </Field>
                  <Field id="post-keywords" label="Additional keywords" optional>
                    <Chips id="post-keywords" values={f.keywords} onChange={(v) => set("keywords", v)} max={10} maxLength={60} placeholder="Add and press Enter" />
                  </Field>
                </div>
                <Field id="post-seoTitle" label={<span className="flex w-full items-center justify-between gap-3">SEO title <Counter value={seoTitle.length} min={SEO_LIMITS.title.min} max={SEO_LIMITS.title.max} /></span>} help={`Leave empty to use “${f.title || "Title"} | Sociotix Blog”.`}>
                  <TextInput id="post-seoTitle" value={f.seoTitle} maxLength={120} onChange={(e) => set("seoTitle", e.target.value)} placeholder={seoTitle || "SEO title"} />
                </Field>
                <Field id="post-metaDescription" label={<span className="flex w-full items-center justify-between gap-3">Meta description <Counter value={desc.length} min={SEO_LIMITS.description.min} max={SEO_LIMITS.description.max} /></span>} help="Leave empty to use the summary.">
                  <TextArea id="post-metaDescription" value={f.metaDescription} maxLength={320} rows={3} onChange={(e) => set("metaDescription", e.target.value)} placeholder={f.excerpt || "What readers will learn, in one or two sentences."} />
                </Field>

                <div>
                  <p className="text-sm font-semibold">Search result preview</p>
                  <div className="mt-2 rounded-xl border bg-white p-4 text-start dark:bg-[#202124]" aria-label="Google search result preview">
                    <p className="truncate text-[0.8rem] text-[#202124] dark:text-[#dadce0]">{url.replace(/^https?:\/\//, "").replace(/\//g, " › ")}</p>
                    <p className="mt-1 line-clamp-1 text-[1.15rem] leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">{seoTitle || "Your post title"}</p>
                    <p className="mt-1 line-clamp-2 text-[0.85rem] leading-relaxed text-[#4d5156] dark:text-[#bdc1c6]">{desc || "Add a meta description to control the text shown under the title."}</p>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">An approximation: search engines may choose different text.</p>
                </div>

                <div className="space-y-4 border-t pt-5">
                  <p className="text-sm font-semibold">Social sharing</p>
                  <Field id="post-socialTitle" label="Social title" optional>
                    <TextInput id="post-socialTitle" value={f.socialTitle} maxLength={120} onChange={(e) => set("socialTitle", e.target.value)} placeholder={f.title || "Defaults to the post title"} />
                  </Field>
                  <Field id="post-socialDescription" label="Social description" optional>
                    <TextArea id="post-socialDescription" value={f.socialDescription} maxLength={320} rows={2} onChange={(e) => set("socialDescription", e.target.value)} placeholder={desc || "Defaults to the meta description"} />
                  </Field>
                  <ImageField id="post-socialImage" label="Social image" help="Defaults to the featured image. JPEG or PNG are shared as-is; other images use the branded card." image={images.social} onChange={(img) => (setImages((x) => ({ ...x, social: img })), set("socialImageId", img?.id ?? null))} />
                </div>
                <div className="rounded-xl bg-muted/40 px-3.5 py-3 text-xs">
                  <p className="font-semibold">Canonical URL</p>
                  <p className="mt-0.5 font-mono break-all text-muted-foreground">{url}</p>
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-semibold">Writing checklist</p>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {goodCount}/{checks.length}
                  </span>
                </div>
                <ul className="mt-2 space-y-2" aria-label="SEO writing checklist">
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
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Suggestions based on common on-page guidelines, not a ranking score. Nothing here changes your post automatically.</p>
              </div>
            </div>
          </Card>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start" aria-label="Post settings">
          <Card className="p-5" aria-labelledby="publish-title">
            <CardHeader id="publish-title" title="Publish" action={<PostStatus state={state} />} />
            {post?.state === "scheduled" && post.publishedAt ? (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarClock className="size-4" aria-hidden /> Goes live {formatDateTime(post.publishedAt, { year: true })}
              </p>
            ) : post?.state === "published" && post.publishedAt ? (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Globe className="size-4" aria-hidden /> Live since {formatDateTime(post.publishedAt, { year: true })}
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Drafts are private: not on the blog, the sitemap or search engines.</p>
            )}
            {state !== "published" ? (
              <fieldset className="mt-4 space-y-2">
                <legend className="sr-only">When to publish</legend>
                {(
                  [
                    ["now", "Publish now"],
                    ["schedule", "Schedule for later"],
                  ] as const
                ).map(([v, label]) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="radio" name="when" value={v} checked={when === v} onChange={() => setWhen(v)} className="size-4 accent-primary" />
                    {label}
                  </label>
                ))}
                {when === "schedule" ? (
                  <Field id="post-publishAt" label="Publish on" error={errFor("publishAt")} help="Your local time. The post goes live automatically.">
                    <TextInput id="post-publishAt" type="datetime-local" value={scheduleAt} min={toLocalInput(new Date())} onChange={(e) => setScheduleAt(e.target.value)} />
                  </Field>
                ) : null}
              </fieldset>
            ) : null}
            <div className="mt-5 grid gap-2">
              {state !== "published" ? (
                <button type="button" onClick={publish} disabled={isBusy} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_12px_28px_-14px_rgb(112_71_235/0.9)] hover:bg-primary/90 disabled:opacity-60">
                  {busy === "publish" ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : when === "schedule" ? <CalendarClock className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />}
                  {state === "scheduled" ? (when === "schedule" ? "Reschedule" : "Publish now instead") : when === "schedule" ? "Schedule" : "Publish"}
                </button>
              ) : (
                <a href={`/blog/${post!.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold hover:bg-muted">
                  <Globe className="size-4" aria-hidden /> View on blog
                </a>
              )}
              {post && state !== "draft" ? (
                <button type="button" onClick={() => setConfirm("unpublish")} disabled={isBusy} className="inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60">
                  <Undo2 className="size-4" aria-hidden /> {state === "scheduled" ? "Cancel schedule" : "Unpublish"}
                </button>
              ) : null}
              {post ? (
                <button type="button" onClick={() => setConfirm("delete")} disabled={isBusy} className="inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60">
                  <Trash2 className="size-4" aria-hidden /> Delete post
                </button>
              ) : null}
            </div>
          </Card>

          <Card className="p-5">
            <ImageField id="post-featuredImage" label="Featured image" help="Shown on the blog card and at the top of the post." image={images.featured} alt={f.featuredImageAlt} onAlt={(v) => set("featuredImageAlt", v)} altError={errFor("featuredImageAlt")} onChange={(img) => (setImages((x) => ({ ...x, featured: img })), setF((x) => ({ ...x, featuredImageId: img?.id ?? null, ...(img ? {} : { featuredImageAlt: "" }) })))} />
          </Card>

          <Card className="space-y-5 p-5">
            <div>
              <Field id="post-category" label="Category" error={errFor("category")}>
                <SelectInput id="post-category" value={f.category} onChange={(e) => set("category", e.target.value)} className="h-10">
                  {cats.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <button type="button" onClick={() => setNewCategory(true)} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                + New category
              </button>
              <NewCategoryDialog open={newCategory} onClose={() => setNewCategory(false)} onAdded={(c) => (cats.add(c), set("category", c.id))} />
            </div>
            <Field id="post-tags" label="Tags" optional help="Up to 12. Press Enter or comma to add.">
              <Chips id="post-tags" values={f.tags} onChange={(v) => set("tags", v)} max={12} maxLength={40} placeholder="Add a tag" />
            </Field>
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold">Author</legend>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="radio" name="authorKind" checked={f.authorKind === "organization"} onChange={() => setF((x) => ({ ...x, authorKind: "organization", authorName: TEAM_AUTHOR }))} className="size-4 accent-primary" />
                  {TEAM_AUTHOR}
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="radio" name="authorKind" checked={f.authorKind === "person"} onChange={() => setF((x) => ({ ...x, authorKind: "person", authorName: x.authorName === TEAM_AUTHOR ? viewerName : x.authorName }))} className="size-4 accent-primary" />
                  A named person
                </label>
                {f.authorKind === "person" ? (
                  <Field id="post-authorName" label="Author name" error={errFor("authorName")} help="Use the real name of the person who wrote it.">
                    <TextInput id="post-authorName" value={f.authorName} maxLength={80} onChange={(e) => set("authorName", e.target.value)} />
                  </Field>
                ) : null}
              </div>
            </fieldset>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input type="checkbox" checked={f.featured} onChange={(e) => set("featured", e.target.checked)} className="mt-0.5 size-4 accent-primary" />
              <span>
                <span className="flex items-center gap-1 font-semibold">
                  <Star className="size-3.5 text-soon" aria-hidden /> Feature on the blog
                </span>
                <span className="block text-xs text-muted-foreground">Shown in “Featured articles” at the top of /blog.</span>
              </span>
            </label>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        busy={busy === "delete" || busy === "unpublish"}
        danger={confirm === "delete"}
        title={confirm === "delete" ? "Delete this post?" : state === "scheduled" ? "Cancel the schedule?" : "Unpublish this post?"}
        description={confirm === "delete" ? <>“{post?.title}” will be permanently deleted{state === "published" ? " and its page will stop working" : ""}. This can&apos;t be undone.</> : <>“{post?.title}” will become a private draft and leave the blog, the sitemap and search results.</>}
        confirmLabel={confirm === "delete" ? "Delete post" : state === "scheduled" ? "Cancel schedule" : "Unpublish"}
        onConfirm={confirmAction}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
