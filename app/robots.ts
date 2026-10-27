import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/n/", "/start", "/signin", "/api/", "/demo"] }],
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
