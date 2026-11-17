"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu } from "@base-ui/react/menu";
import { Check, CircleAlert, Copy, MoreHorizontal, Palette, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/dashboard/account-ui";
import { menuItem, menuItemDestructive, menuPopup } from "@/components/ui/menu";
import { BRAND_ROUTES, BRANDS_MAX, brandHref, type BrandView } from "@/lib/brand";
import { SOCIAL_PLATFORM } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";
import { PageGuide } from "@/components/dashboard/page-guide";
import { EmptyIllustration } from "@/components/social/publishing-parts";
import { page, primaryButton, quietButton, eyebrow, socialApi } from "@/components/social/parts";
import { BrandMark, ColorSwatches, brandField } from "./brand-parts";

type Notice = { ok: boolean; text: string } | null;

/** The Brand Kit workspace: every brand the customer has, with search and the actions that apply to each. */
export function BrandKit({ brands }: { brands: BrandView[] }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<Notice>(null);
  const [deleting, setDeleting] = React.useState<BrandView | null>(null);
  const inFlight = React.useRef(false);

  const term = q.trim().toLowerCase();
  const list = brands.filter((b) => !term || `${b.name} ${b.industry} ${b.description} ${b.toneOfVoice} ${b.keywords.join(" ")}`.toLowerCase().includes(term));
  const full = brands.length >= BRANDS_MAX;

  /** One action at a time, so a double click can't send it twice. */
  async function act(id: string, path: string, init: RequestInit, ok: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(id);
    setNotice(null);
    const r = await socialApi<Record<string, unknown>>(path, init);
    inFlight.current = false;
    setBusy(null);
    setNotice(r.ok ? { ok: true, text: ok } : { ok: false, text: r.message });
    if (r.ok) router.refresh();
  }

  return (
    <div className={page}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className={cn(eyebrow, "text-primary")}>Sociotix AI · Brand Kit</p>
          <h1 className="mt-1.5 font-heading text-[1.6rem] leading-tight font-extrabold tracking-tight sm:text-[1.9rem]">Brand Kit</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-[0.95rem]">Keep each brand&apos;s identity, audience and voice in one place, then reuse it across your content and AI tools.</p>
        </div>
        {full ? (
          <p className="text-[0.8rem] text-muted-foreground">You&apos;ve reached the limit of {BRANDS_MAX} brands.</p>
        ) : (
          <Link href={BRAND_ROUTES.create} className={primaryButton}>
            <Plus className="size-4" aria-hidden /> New brand
          </Link>
        )}
      </header>

      {brands.length ? (
        <PageGuide
          id="brands"
          className="mt-4"
          steps={[
            { title: "Describe your brand", body: "Logo, colours, who it's for and how it should sound." },
            { title: "Use it on posts", body: "Pick the brand when writing. Its words to avoid and hashtags show beside the editor." },
            { title: "One default", body: "Your default brand is picked for you on new posts and plans." },
          ]}
        />
      ) : null}
      <div className="mt-3 min-h-0" aria-live="polite">
        {notice ? (
          <p role={notice.ok ? "status" : "alert"} className={cn("flex items-start gap-2 rounded-2xl px-4 py-3 text-[0.85rem] font-medium", notice.ok ? "bg-secondary text-secondary-foreground" : "bg-destructive/[0.08] text-destructive")}>
            {notice.ok ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
            {notice.text}
          </p>
        ) : null}
      </div>

      {brands.length === 0 ? (
        <section className="mt-4 flex flex-col items-center rounded-3xl border border-dashed bg-card px-6 py-14 text-center" aria-labelledby="brand-empty">
          <EmptyIllustration icon={Palette} />
          <h2 id="brand-empty" className="mt-4 font-heading text-lg font-extrabold">
            Create your first brand
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">Add a logo, colors and how the brand sounds. You can keep several brands, for example one per business or client, and assign them to your drafts.</p>
          <Link href={BRAND_ROUTES.create} className={cn(primaryButton, "mt-5")}>
            <Plus className="size-4" aria-hidden /> Create a brand
          </Link>
        </section>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="relative min-w-0 flex-1 basis-56">
              <span className="sr-only">Search your brands</span>
              <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your brands" className={cn(brandField, "h-11 rounded-full py-0 ps-10 text-sm sm:h-10")} />
            </label>
            <p className="text-[0.8rem] text-muted-foreground" aria-live="polite">
              {list.length === brands.length ? `${brands.length} ${brands.length === 1 ? "brand" : "brands"}` : `${list.length} of ${brands.length} brands`}
            </p>
          </div>

          {list.length === 0 ? (
            <section className="mt-4 rounded-3xl border bg-card px-6 py-10 text-center">
              <EmptyIllustration icon={Search} />
              <p className="mt-3 font-heading text-lg font-bold">No brands match</p>
              <p className="mt-1 text-sm text-muted-foreground">Try a different search.</p>
              <button type="button" className={cn(quietButton, "mt-4")} onClick={() => setQ("")}>
                Clear search
              </button>
            </section>
          ) : (
            <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Your brands">
              {list.map((b) => (
                <li key={b.id}>
                  <BrandCard
                    brand={b}
                    busy={busy === b.id}
                    disabled={busy !== null}
                    canDuplicate={!full}
                    onDefault={() => void act(b.id, `/api/brands/${b.id}/default`, { method: "POST" }, `${b.name} is now your default brand.`)}
                    onDuplicate={() => void act(b.id, `/api/brands/${b.id}/duplicate`, { method: "POST" }, `${b.name} was duplicated.`)}
                    onDelete={() => setDeleting(b)}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting ? `Delete ${deleting.name}?` : "Delete brand?"}
        description={
          deleting
            ? deleting.postCount > 0
              ? `${deleting.postCount} ${deleting.postCount === 1 ? "draft uses" : "drafts use"} this brand. They keep all their content and simply have no brand afterwards. Your images stay in your media library.`
              : "No drafts use this brand. Your images stay in your media library."
            : ""
        }
        confirmLabel="Delete brand"
        tone="danger"
        icon={Trash2}
        onConfirm={() => {
          const b = deleting;
          setDeleting(null);
          if (b) void act(b.id, `/api/brands/${b.id}`, { method: "DELETE" }, `${b.name} was deleted. Your drafts were kept.`);
        }}
      />
    </div>
  );
}

function BrandCard({ brand: b, busy, disabled, canDuplicate, onDefault, onDuplicate, onDelete }: { brand: BrandView; busy: boolean; disabled: boolean; canDuplicate: boolean; onDefault: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const bands = [b.primaryColor, b.secondaryColor, b.accentColor].filter((c): c is string => Boolean(c));
  return (
    <article className={cn("group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-card shadow-soft transition-shadow hover:shadow-float", busy && "opacity-70")} aria-busy={busy || undefined}>
      {/* A flat band of the brand's own colors (or violet when it has none). */}
      <div className="flex h-2.5" aria-hidden>
        {(bands.length ? bands : ["#7047eb"]).map((c, i) => (
          <span key={`${c}-${i}`} className="flex-1" style={{ backgroundColor: c }} />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <BrandMark brand={b} className="size-12 text-base" />
          <div className="min-w-0 flex-1">
            <Link href={brandHref(b.id)} className="block truncate rounded text-[1rem] font-bold outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40">
              {b.name}
            </Link>
            <p className="truncate text-[0.78rem] text-muted-foreground">{b.industry || "No industry yet"}</p>
          </div>
          {b.isDefault ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-lime/70 px-2 py-0.5 text-[0.68rem] font-bold text-[#1b2400]">
              <Star className="size-3 fill-current" aria-hidden /> Default
            </span>
          ) : null}
          <Menu.Root>
            <Menu.Trigger aria-label={`More actions for ${b.name}`} disabled={disabled} className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 disabled:opacity-50">
              <MoreHorizontal className="size-4" aria-hidden />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner sideOffset={6} align="end" className="z-50 outline-none">
                <Menu.Popup className={cn(menuPopup, "min-w-48")}>
                  <Menu.Item render={<Link href={brandHref(b.id)} />} className={menuItem}>
                    <Pencil className="size-4" aria-hidden /> Edit
                  </Menu.Item>
                  {!b.isDefault ? (
                    <Menu.Item className={menuItem} onClick={onDefault}>
                      <Star className="size-4" aria-hidden /> Set as default
                    </Menu.Item>
                  ) : null}
                  <Menu.Item className={menuItem} onClick={onDuplicate} disabled={!canDuplicate}>
                    <Copy className="size-4" aria-hidden /> Duplicate
                  </Menu.Item>
                  <Menu.Item className={cn(menuItem, menuItemDestructive)} onClick={onDelete}>
                    <Trash2 className="size-4" aria-hidden /> Delete
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>

        <p className="line-clamp-2 min-h-[2.6em] text-[0.82rem] leading-relaxed text-muted-foreground">{b.description || b.toneOfVoice || "Add a description and a tone of voice to complete this brand."}</p>

        {b.personality.length ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Personality">
            {b.personality.slice(0, 4).map((p) => (
              <li key={p} className="rounded-full border bg-muted/40 px-2.5 py-0.5 text-[0.72rem]">
                {p}
              </li>
            ))}
            {b.personality.length > 4 ? <li className="px-1 py-0.5 text-[0.72rem] text-muted-foreground">+{b.personality.length - 4}</li> : null}
          </ul>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
          <ColorSwatches brand={b} />
          {b.platforms.length ? <span className="text-[0.72rem] text-muted-foreground">{b.platforms.map((p) => SOCIAL_PLATFORM[p].name).join(" · ")}</span> : null}
          <span className="ms-auto text-[0.72rem] text-muted-foreground">
            {b.postCount} {b.postCount === 1 ? "draft" : "drafts"}
          </span>
        </div>
      </div>
    </article>
  );
}
