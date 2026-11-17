import type { Metadata } from "next";
import { BrandEditor } from "@/components/brand/brand-editor";
import { BrandEditorPage } from "@/components/brand/loader";

export const metadata: Metadata = { title: "Edit brand" };

export default function EditBrandRoute({ params }: PageProps<"/dashboard/brand-kit/[id]">) {
  return <BrandEditorPage params={params} render={(data) => <BrandEditor key={data.brand?.id} {...data} />} />;
}
