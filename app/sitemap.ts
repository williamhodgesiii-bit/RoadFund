import type { MetadataRoute } from "next";

const PAGES = ["", "/pricing", "/calculator", "/guide", "/closing", "/contractors", "/verify", "/help", "/about", "/legal"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return PAGES.map((p) => ({ url: `${base}${p}`, changeFrequency: "monthly", priority: p === "" ? 1 : 0.6 }));
}
