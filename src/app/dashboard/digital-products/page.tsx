import type { Metadata } from "next";
import { Suspense } from "react";
import { DigitalLibrary } from "@/components/dashboard/digital-library/library";
import { customerPage } from "@/server/auth/pages";
import { getDb } from "@/server/db/client";
import { customerLibrary } from "@/server/digital-products/library";
import LibraryLoading from "./loading";

export const metadata: Metadata = { title: "My Digital Products" };

/** The signed-in customer's own library and download history, loaded per request (real records in every mode). */
async function Library() {
  const r = await customerPage();
  if (r.status !== "ok") return null;
  return <DigitalLibrary library={await customerLibrary(getDb(), r.viewer.userId)} />;
}

export default function DigitalProductsLibraryPage() {
  return (
    <Suspense fallback={<LibraryLoading />}>
      <Library />
    </Suspense>
  );
}
