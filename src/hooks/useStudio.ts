"use client";
import { useShallow } from "zustand/react/shallow";
import { useStudioStore } from "@/stores/studioStore";

export function validateProductImage(file: File) {
  const accepted = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!accepted.has(file.type)) return "Choose a JPEG, PNG, or WebP image.";
  if (file.size > 20 * 1024 * 1024) return "Source image must be 20 MB or smaller. The app will compress it before sending.";
  return null;
}

/** Compresses source images in the browser so base64 JSON stays below serverless request limits. */
export async function prepareProductImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40_000_000) {
      throw new Error("Image dimensions exceed the supported limit.");
    }
    let scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
    let quality = 0.88;
    for (let attempt = 0; attempt < 7; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image processing is not available in this browser.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not compress this image.")), "image/webp", quality);
      });
      if (blob.size <= 2_500_000) {
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error("Could not prepare the compressed image."));
          reader.onload = () => resolve(String(reader.result ?? ""));
          reader.readAsDataURL(blob);
        });
      }
      scale *= 0.82;
      quality = Math.max(0.55, quality - 0.05);
    }
    throw new Error("Could not compress this image under the upload limit. Try a smaller source image.");
  } finally {
    bitmap.close();
  }
}

export function useStudio() {
  return useStudioStore(useShallow((state) => ({
    prompt: state.prompt,
    mode: state.mode,
    quality: state.quality,
    aspectRatio: state.aspectRatio,
    resolution: state.resolution,
    setPrompt: state.setPrompt,
    setMode: state.setMode,
    setQuality: state.setQuality,
    setAspectRatio: state.setAspectRatio,
    setResolution: state.setResolution,
    reset: state.reset,
  })));
}
