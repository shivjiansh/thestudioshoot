import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.APP_URL ?? "https://thestudioshot.example").replace(/\/$/, "");
  return { rules: [{ userAgent: "*", allow: ["/", "/features", "/how-it-works", "/pricing", "/docs", "/docs/api"], disallow: ["/api/", "/dashboard", "/studio", "/gallery", "/history", "/billing", "/settings", "/developer", "/admin"] }], sitemap: `${base}/sitemap.xml` };
}
