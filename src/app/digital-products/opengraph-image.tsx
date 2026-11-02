import { OG_SIZE, ogImage } from "@/lib/seo/og";

export const alt = "Sociotix Digital Products Marketplace";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogImage({ eyebrow: "Sociotix Digital Products", title: "Digital Tools. Bigger Possibilities.", subtitle: "Templates, prompts, planners, guides and creative toolkits for social media work." });
}
