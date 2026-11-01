import { ImageResponse } from "next/og";
import { ALL_ARTICLES, articleCategoryName } from "@/lib/blog";
import { OG_SIZE, ogImage } from "@/lib/seo/og";
import { findPublicArticle, liveAdminArticles, socialImageDataUri } from "@/server/blog/public";

export const alt = "A Sociotix Blog article";
export const size = OG_SIZE;
export const contentType = "image/png";

export async function generateStaticParams() {
  return [...ALL_ARTICLES, ...(await liveAdminArticles())].map((a) => ({ slug: a.slug }));
}

/** The post's own social image when it's a JPEG or PNG; otherwise the branded card with its title. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const a = (await findPublicArticle(slug)) ?? ALL_ARTICLES[0];
  const photo = a.social?.image ? await socialImageDataUri(a.social.image.src) : null;
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
  const title = a.social?.title ?? a.title;
  const subtitle = a.social?.description ?? a.description;
  return ogImage({ eyebrow: `Sociotix Blog · ${articleCategoryName(a)}`, title, subtitle: subtitle.length > 120 ? `${subtitle.slice(0, 117)}…` : subtitle });
}
