import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // TASK-051 — the motion-system showcase route; also carries a
      // page-level `robots: { index: false, follow: false }` in its own
      // metadata, so this is belt-and-suspenders rather than the only guard.
      disallow: "/internal",
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
