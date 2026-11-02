import { ImageResponse } from "next/og";
import { PREVIEW_PRODUCTS, productCategoryName } from "@/lib/digital-products";
import { OG_SIZE, ogImage } from "@/lib/seo/og";
import { socialImageDataUri } from "@/server/blog/public";
import { findMarketplaceProduct, getMarketplace } from "@/server/digital-products/public";

export const alt = "A Sociotix digital product";
export const size = OG_SIZE;
export const contentType = "image/png";

export async function generateStaticParams() {
  return (await getMarketplace()).products.map((p) => ({ slug: p.id }));
}

/** The product's own social image when it's a JPEG or PNG; otherwise the branded card with its title. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const p = (await findMarketplaceProduct(slug))?.product ?? PREVIEW_PRODUCTS[0];
  const photo = p.social?.image ? await socialImageDataUri(p.social.image.src) : null;
  if (photo)
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", background: "#141519" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered by ImageResponse, not the browser */}
          <img src={photo} alt="" width={OG_SIZE.width} height={OG_SIZE.height} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ),
      OG_SIZE,
    );
  const subtitle = p.social?.description ?? p.description;
  return ogImage({ eyebrow: `Sociotix Digital Products · ${productCategoryName(p)}`, title: p.social?.title ?? p.title, subtitle: subtitle.length > 120 ? `${subtitle.slice(0, 117)}…` : subtitle });
}
