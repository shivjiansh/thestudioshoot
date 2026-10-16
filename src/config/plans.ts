export type Resolution = "1K" | "2K" | "4K";
export type Plan = {
  id: string;
  name: string;
  priceInr: number;
  exportsPerMonth: number;
  aiCreditsPerMonth: number;
  maxResolution: Resolution;
  maxBatchSize: number;
  maxImportedAssets: number;
  watermark: boolean;
  commercialUse: boolean;
  priorityQueue: boolean;
  aiGeneration: boolean;
};

export const CONSUMER_PLANS: Record<string, Plan> = {
  free: { id: "free", name: "Free", priceInr: 0, exportsPerMonth: 100, aiCreditsPerMonth: 0, maxResolution: "1K", maxBatchSize: 1, maxImportedAssets: 100, watermark: true, commercialUse: false, priorityQueue: false, aiGeneration: false },
  pro: { id: "pro", name: "Pro", priceInr: 999, exportsPerMonth: 1000, aiCreditsPerMonth: 8000, maxResolution: "2K", maxBatchSize: 50, maxImportedAssets: 1000, watermark: false, commercialUse: true, priorityQueue: false, aiGeneration: true },
  max: { id: "max", name: "Max", priceInr: 2799, exportsPerMonth: 3000, aiCreditsPerMonth: 25000, maxResolution: "2K", maxBatchSize: 250, maxImportedAssets: 5000, watermark: false, commercialUse: true, priorityQueue: false, aiGeneration: true },
  ultra: { id: "ultra", name: "Ultra", priceInr: 7999, exportsPerMonth: 10000, aiCreditsPerMonth: 75000, maxResolution: "4K", maxBatchSize: 1000, maxImportedAssets: 10000, watermark: false, commercialUse: true, priorityQueue: true, aiGeneration: true },
};

// API plan resolution ceilings are an explicit product assumption: Starter=1K, Scale=2K.
// Revisit these limits alongside the flat per-call prices before exposing high-resolution API output.
export const API_PLANS = {
  starter: { id: "starter", name: "API Starter", priceInr: 1699, pricePerCallInr: 2, requestsPerMinute: 60, maxResolution: "1K" as Resolution },
  scale: { id: "scale", name: "API Scale", priceInr: 8499, pricePerCallInr: 5, requestsPerMinute: 600, maxResolution: "2K" as Resolution },
} as const;

// Credit costs are a configurable product policy, not a direct mapping to provider cost.
export const CREDIT_COSTS = {
  "1K": { low: 500, medium: 1000, high: 2000 },
  "2K": { low: 1000, medium: 2500, high: 5000 },
  "4K": { low: 2500, medium: 6000, high: 12000 },
} as const;
export const EDIT_CREDIT_MULTIPLIER = 1.25;

export function getPlan(id: string): Plan {
  return Object.prototype.hasOwnProperty.call(CONSUMER_PLANS, id) ? CONSUMER_PLANS[id] : CONSUMER_PLANS.free;
}

const RESOLUTION_RANK: Record<Resolution, number> = { "1K": 1, "2K": 2, "4K": 3 };
export function resolutionAllowed(requested: Resolution, maximum: Resolution) {
  return RESOLUTION_RANK[requested] <= RESOLUTION_RANK[maximum];
}
