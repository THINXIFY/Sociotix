import type { Metadata } from "next";
import { ContentLibrary } from "@/components/social/content-library";
import { ContentPage } from "@/components/social/loader";

export const metadata: Metadata = { title: "Content Library" };

export default function ContentLibraryPage() {
  return <ContentPage render={(data) => <ContentLibrary data={data} />} />;
}
