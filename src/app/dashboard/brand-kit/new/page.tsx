import type { Metadata } from "next";
import { BrandEditor } from "@/components/brand/brand-editor";
import { BrandEditorPage } from "@/components/brand/loader";

export const metadata: Metadata = { title: "New brand" };

export default function NewBrandRoute() {
  return <BrandEditorPage render={(data) => <BrandEditor key="new" {...data} />} />;
}
