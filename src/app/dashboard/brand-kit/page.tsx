import type { Metadata } from "next";
import { BrandKit } from "@/components/brand/brand-kit";
import { BrandKitPage } from "@/components/brand/loader";

export const metadata: Metadata = { title: "Brand Kit" };

export default function BrandKitRoute() {
  return <BrandKitPage render={(brands) => <BrandKit brands={brands} />} />;
}
