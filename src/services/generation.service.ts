import "server-only";
import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";
import { generateImage, type GenerationInput } from "@/lib/ai/openai";
import { deleteImage, saveImage, signedImage } from "@/lib/storage/service";
import { finalize, finalizeUnbilled, reserve, type GeneratedAssetRecord } from "@/lib/credits/service";
import { CREDIT_COSTS, EDIT_CREDIT_MULTIPLIER } from "@/config/plans";

export type GenerationSource = "studio" | "developer_api";
export type RunGenerationArgs = {
  uid: string;
  input: GenerationInput;
  planId: string;
  requestId: string;
  source: GenerationSource;
  billCredits: boolean;
  apiKeyId?: string;
  jobId?: string;
};

export function estimateGenerationCredits(input: GenerationInput) {
  const qualityCost = CREDIT_COSTS[input.resolution][input.quality];
  // Editing is more compute-intensive in this initial configurable credit model.
  return input.imageDataUrl ? Math.ceil(qualityCost * EDIT_CREDIT_MULTIPLIER) : qualityCost;
}

/** Shared orchestration path for studio and API requests. Writes job + asset state atomically. */
export async function runGeneration(args: RunGenerationArgs) {
  const { uid, input, planId, requestId, source, billCredits, apiKeyId } = args;
  const jobId = args.jobId ?? randomUUID();
  const credits = estimateGenerationCredits(input);
  const jobRef = db.collection("generationJobs").doc(jobId);

  if (billCredits) {
    await reserve(uid, jobId, credits, planId, input.resolution);
  } else {
    await jobRef.create({ uid, jobId, status: "processing", planId, creditsReserved: 0, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  }

  let storagePath: string | undefined;
  let resultUrl = "";
  try {
    await jobRef.set({
      prompt: input.prompt, mode: input.mode, quality: input.quality, aspectRatio: input.aspectRatio, resolution: input.resolution,
      requestId, source, apiKeyId: apiKeyId ?? null, updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    const generated = await generateImage(input);
    storagePath = await saveImage(uid, jobId, generated.dataUrl);
    // Never expose original object URLs to browser pages. Studio previews are first-party and watermarked.
    resultUrl = source === "studio" ? `/api/assets/${jobId}/preview` : await signedImage(storagePath);
    const asset: GeneratedAssetRecord = {
      storagePath, model: generated.model, prompt: input.prompt, mode: input.mode,
      quality: input.quality, source, resolution: input.resolution,
    };

    if (billCredits) {
      await finalize(uid, jobId, "succeeded", asset);
    } else {
      await finalizeUnbilled(uid, jobId, "succeeded", asset);
    }
    return { jobId, status: "succeeded" as const, resultUrl, creditsReserved: billCredits ? credits : 0, resolution: input.resolution, requestedSize: generated.requestedSize };
  } catch (error) {
    // A transient error can happen after Firestore committed. Do not delete a successful asset or refund it twice.
    const latest = await jobRef.get().catch(() => null);
    if (latest?.exists && latest.data()?.status === "succeeded" && resultUrl) {
      return { jobId, status: "succeeded" as const, resultUrl, creditsReserved: billCredits ? credits : 0, resolution: input.resolution, requestedSize: "unknown" };
    }

    if (storagePath) {
      await deleteImage(storagePath).catch((cleanupError) => console.error("Generated object cleanup failed", { requestId, jobId, cleanupError }));
    }
    if (billCredits) {
      await finalize(uid, jobId, "failed").catch((refundError) => console.error("Credit refund failed", { requestId, jobId, refundError }));
    } else {
      await finalizeUnbilled(uid, jobId, "failed").catch((updateError) => console.error("API job failure update failed", { requestId, jobId, updateError }));
    }
    throw error;
  }
}
