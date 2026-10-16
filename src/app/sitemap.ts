import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.APP_URL ?? "https://thestudioshot.example").replace(/\/$/, "");
  const lastModified = new Date();
  return ["", "/features", "/how-it-works", "/pricing", "/docs", "/docs/api", "/privacy", "/terms", "/refund-policy", "/contact"].map((path) => ({ url: `${base}${path}`, lastModified, changeFrequency: "monthly", priority: path === "" ? 1 : 0.6 }));
}
