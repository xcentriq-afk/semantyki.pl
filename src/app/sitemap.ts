import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://symantyka.pl",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
