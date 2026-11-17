import "server-only";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ServiceUnavailable } from "@/components/auth/states";
import type { BrandView } from "@/lib/brand";
import type { MediaView } from "@/lib/social/content";
import { customerPage } from "@/server/auth/pages";
import { getBrand, listBrands } from "@/server/brand";
import { contentMeta } from "@/server/content";
import { getDb } from "@/server/db/client";
import { AppError } from "@/server/errors";

/** Loads the signed-in customer's own brands per request. Brand data is private: there is no public or sample data. */
function Fallback() {
  const block = "animate-pulse rounded-3xl bg-muted motion-reduce:animate-none";
  return (
    <div className="mx-auto max-w-[90rem] px-3 py-4 sm:px-6 sm:py-7 lg:px-8" aria-busy="true">
      <span className="sr-only">Loading your Brand Kit…</span>
      <div className={`h-20 max-w-lg ${block}`} />
      <div className={`mt-5 h-11 max-w-md ${block}`} />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-56 ${block}`} />
        ))}
      </div>
    </div>
  );
}

async function LoadList({ render }: { render: (brands: BrandView[]) => React.ReactNode }) {
  await connection();
  const r = await customerPage();
  if (r.status !== "ok") return <ServiceUnavailable />;
  return <>{render(await listBrands(getDb(), r.viewer.customerId))}</>;
}

export function BrandKitPage({ render }: { render: (brands: BrandView[]) => React.ReactNode }) {
  return (
    <Suspense fallback={<Fallback />}>
      <LoadList render={render} />
    </Suspense>
  );
}

export interface EditorData {
  /** Undefined when creating. */
  brand?: BrandView;
  /** How many brands the customer has (to explain the limit). */
  count: number;
  /** The customer's media library, for choosing a logo and cover. */
  media: MediaView[];
}

async function LoadEditor({ params, render }: { params?: Promise<{ id: string }>; render: (data: EditorData) => React.ReactNode }) {
  const id = params ? (await params).id : undefined;
  await connection();
  const r = await customerPage();
  if (r.status !== "ok") return <ServiceUnavailable />;
  const db = getDb();
  let brand: BrandView | undefined;
  if (id) {
    try {
      brand = await getBrand(db, r.viewer.customerId, id);
    } catch (e) {
      if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
      throw e;
    }
  }
  const [all, content] = await Promise.all([listBrands(db, r.viewer.customerId), contentMeta(db, r.viewer.customerId)]);
  return <>{render({ brand, count: all.length, media: content.media })}</>;
}

export function BrandEditorPage({ params, render }: { params?: Promise<{ id: string }>; render: (data: EditorData) => React.ReactNode }) {
  return (
    <Suspense fallback={<Fallback />}>
      <LoadEditor params={params} render={render} />
    </Suspense>
  );
}
