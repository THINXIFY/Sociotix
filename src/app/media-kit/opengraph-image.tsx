import { OG_SIZE, ogImage } from "@/lib/seo/og";

export const alt = "Sociotix Media Kit — logo, colors and brand assets";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogImage({ eyebrow: "Sociotix · Media Kit", title: "The Art of Our Brand.", subtitle: "Logo, colors, type and the words we use to describe ourselves." });
}
