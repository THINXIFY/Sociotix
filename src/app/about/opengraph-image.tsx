import { OG_SIZE, ogImage } from "@/lib/seo/og";

export const alt = "About Sociotix — an AI-powered social growth and marketing platform";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogImage({ eyebrow: "About Sociotix", title: "Social growth, made simple.", subtitle: "Services, AI marketing tools, social management and automation in one account." });
}
