import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { LibraryProductDetail } from "@/components/dashboard/digital-library/product-detail";
import { LIBRARY_PATH } from "@/lib/digital-products/library";
import { customerPage } from "@/server/auth/pages";
import { getDb } from "@/server/db/client";
import { customerLibraryItem } from "@/server/digital-products/library";
import LibraryLoading from "../loading";

export const metadata: Metadata = { title: "My Digital Products" };

/** A product the customer can access; anything else (paid, unreleased, unpublished, removed) explains itself. */
async function Detail({ params }: { params: Promise<{ slug: string }> }) {
  const r = await customerPage();
  if (r.status !== "ok") return null;
  const slug = (await params).slug;
  const item = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= 80 ? await customerLibraryItem(getDb(), r.viewer.userId, slug) : null;
  if (item) return <LibraryProductDetail item={item} />;
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground" aria-hidden>
        <Lock className="size-6" />
      </span>
      <h1 className="mt-4 font-heading text-2xl font-extrabold">This product isn&apos;t in your library</h1>
      <p className="mt-2 text-sm text-muted-foreground">It may have been removed or unpublished, or it isn&apos;t available to download. Paid products can&apos;t be bought yet.</p>
      <Link href={LIBRARY_PATH} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
        <ArrowLeft className="size-4" aria-hidden /> Back to your library
      </Link>
    </div>
  );
}

export default function LibraryProductPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<LibraryLoading />}>
      <Detail params={params} />
    </Suspense>
  );
}
