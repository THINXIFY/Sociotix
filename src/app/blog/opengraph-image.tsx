import { OG_SIZE, ogImage } from "@/lib/seo/og";

export const alt = "Sociotix Blog — Ideas That Drive Growth";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogImage({ eyebrow: "Sociotix Blog", title: "Ideas That Drive Growth.", subtitle: "Practical guides on social media, AI marketing, content planning and automation." });
}
