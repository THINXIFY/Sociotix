import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo/site";

/** Web app manifest: names and the violet Sociotix icon for home screens and app switchers. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    start_url: "/",
    display: "browser",
    background_color: "#F8F9FC",
    theme_color: "#7047EB",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
