import { z } from "zod";

export const generationSchema = z.object({
  prompt: z.string().trim().min(8).max(1800),
  mode: z.enum(["studio", "lifestyle", "background", "catalog", "social"]).default("studio"),
  quality: z.enum(["low", "medium", "high"]).default("medium"),
  aspectRatio: z.enum(["square", "portrait", "landscape"]).default("square"),
  resolution: z.enum(["1K", "2K", "4K"]).default("1K"),
  imageDataUrl: z.string().max(4_000_000).optional(),
});
export type GenerationInput = z.infer<typeof generationSchema>;
