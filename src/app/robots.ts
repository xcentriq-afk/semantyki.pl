import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://symantyka.pl/sitemap.xml",
    host: "https://symantyka.pl",
  };
}
