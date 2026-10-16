import "server-only";
import OpenAI from "openai";
import sharp from "sharp";
import { env, need } from "@/lib/env";
import { HttpError } from "@/lib/http/errors";
import type { GenerationInput } from "@/lib/validation/generation";

const guidance: Record<GenerationInput["mode"], string> = {
  studio: "Premium commercial studio product photograph with controlled softbox lighting, clear materials, and realistic contact shadows.",
  lifestyle: "Tasteful lifestyle product photograph in a believable premium setting with natural light and refined art direction.",
  background: "Replace the scene with a refined professional product-photography background, preserving product details as much as possible.",
  catalog: "Clean e-commerce catalog photograph with neutral background, accurate product proportions, readable details, and subtle shadows.",
  social: "Editorial product campaign creative with intentional negative space, striking composition, and polished commercial art direction.",
};

// These current image API models support custom WIDTHxHEIGHT outputs. If another model is configured,
// the adapter fails closed for 2K/4K instead of silently claiming or returning the requested resolution.
const customResolutionModels = new Set([
  "gpt-image-2",
  "gpt-image-2-2026-04-21",
  "gpt-image-2.5-sunburst",
  "gpt-image-2.5-sunburst-2026-09-08",
  "gpt-image-2.5-flare",
  "gpt-image-2.5-flare-2026-09-08",
]);

function outputSize(input: GenerationInput) {
  if (input.resolution !== "1K" && !customResolutionModels.has(env.openaiImageModel)) {
    throw new HttpError("MODEL_RESOLUTION_UNSUPPORTED", `Model ${env.openaiImageModel} does not have a configured verified ${input.resolution} output path. Configure a supported GPT Image 2 model.`, 503);
  }
  const sizes: Record<GenerationInput["resolution"], Record<GenerationInput["aspectRatio"], string>> = {
    "1K": { square: "1024x1024", landscape: "1536x1024", portrait: "1024x1536" },
    "2K": { square: "2048x2048", landscape: "2048x1152", portrait: "1152x2048" },
    // GPT Image 2.5 supports 8.29 MP at most. Square is 2880x2880; portrait/landscape are 4K-class 16:9.
    "4K": { square: "2880x2880", landscape: "3840x2160", portrait: "2160x3840" },
  };
  return sizes[input.resolution][input.aspectRatio];
}

function imageBufferFromDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new HttpError("INVALID_IMAGE", "Image must be a base64 JPEG, PNG, or WebP data URL.", 400);
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.byteLength > 3 * 1024 * 1024) throw new HttpError("IMAGE_TOO_LARGE", "Compressed source image must be 3 MB or smaller.", 413);
  return { bytes, mime: match[1] };
}

async function validateImageBytes(bytes: Buffer, mime: string) {
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 }).metadata();
  } catch {
    throw new HttpError("INVALID_IMAGE_CONTENT", "The uploaded image could not be decoded.", 400);
  }
  const expectedFormat = mime === "image/jpeg" ? "jpeg" : mime === "image/webp" ? "webp" : "png";
  if (metadata.format !== expectedFormat) throw new HttpError("MIME_MISMATCH", "Declared image type does not match the file contents.", 400);
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > 40_000_000) {
    throw new HttpError("IMAGE_DIMENSIONS_INVALID", "Image dimensions exceed the supported limit.", 400);
  }
}

export async function generateImage(input: GenerationInput) {
  const model = env.openaiImageModel;
  const openai = new OpenAI({ apiKey: need(env.openaiKey, "OPENAI_API_KEY"), timeout: 120_000, maxRetries: 1 });
  const size = outputSize(input);
  const prompt = `${guidance[input.mode]} Product brief: ${input.prompt}. Preserve product shape, color, packaging, brand marks, and labels as accurately as possible; do not invent extra text. Create one polished commercial image.`;
  let base64: string | undefined;

  if (input.imageDataUrl) {
    const { bytes, mime } = imageBufferFromDataUrl(input.imageDataUrl);
    await validateImageBytes(bytes, mime);
    const extension = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
    // The API currently documents arbitrary WIDTHxHEIGHT strings for supported GPT Image 2 models.
    // The SDK's size union may lag that API flexibility, so this narrow boundary cast keeps validation here.
    const providerSize = size as Parameters<OpenAI["images"]["edit"]>[0]["size"];
    const response = await openai.images.edit({
      model,
      image: new File([bytes], `product.${extension}`, { type: mime }),
      prompt,
      size: providerSize,
      quality: input.quality,
    });
    base64 = response.data?.[0]?.b64_json;
  } else {
    const providerSize = size as Parameters<OpenAI["images"]["generate"]>[0]["size"];
    const response = await openai.images.generate({ model, prompt, size: providerSize, quality: input.quality, n: 1 });
    base64 = response.data?.[0]?.b64_json;
  }

  if (!base64) throw new HttpError("IMAGE_PROVIDER_EMPTY_RESULT", "The image provider returned no image data.", 502);
  return { dataUrl: `data:image/png;base64,${base64}`, model, resolution: input.resolution, requestedSize: size };
}
