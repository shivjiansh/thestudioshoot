import { describe, it, expect } from "vitest";
import { API_PLANS, CONSUMER_PLANS, getPlan, resolutionAllowed, CREDIT_COSTS } from "@/config/plans";

describe("plan catalog and entitlements", () => {
  it("blocks Free AI and configures watermarked non-commercial exports", () => {
    expect(CONSUMER_PLANS.free).toMatchObject({ priceInr: 0, exportsPerMonth: 100, aiCreditsPerMonth: 0, watermark: true, commercialUse: false, aiGeneration: false, maxResolution: "1K", maxBatchSize: 1 });
  });
  it("keeps consumer paid plan prices, credits, and limits", () => {
    expect(CONSUMER_PLANS.pro).toMatchObject({ priceInr: 999, exportsPerMonth: 1000, aiCreditsPerMonth: 8000, maxResolution: "2K", maxBatchSize: 50 });
    expect(CONSUMER_PLANS.max).toMatchObject({ priceInr: 2799, exportsPerMonth: 3000, aiCreditsPerMonth: 25000, maxResolution: "2K", maxBatchSize: 250 });
    expect(CONSUMER_PLANS.ultra).toMatchObject({ priceInr: 7999, exportsPerMonth: 10000, aiCreditsPerMonth: 75000, maxResolution: "4K", maxBatchSize: 1000, priorityQueue: true });
  });
  it("defaults unknown plan identifiers to the least-privileged plan", () => { expect(getPlan("bogus").id).toBe("free"); });
  it("enforces resolution ceilings", () => { expect(resolutionAllowed("1K", "1K")).toBe(true); expect(resolutionAllowed("2K", "1K")).toBe(false); expect(resolutionAllowed("4K", "2K")).toBe(false); expect(resolutionAllowed("4K", "4K")).toBe(true); });
  it("uses distinct configurable credit costs by requested resolution and quality", () => { expect(CREDIT_COSTS["1K"].low).toBeLessThan(CREDIT_COSTS["2K"].low); expect(CREDIT_COSTS["2K"].high).toBeLessThan(CREDIT_COSTS["4K"].high); });
  it("keeps the requested Developer API pricing and request limits", () => { expect(API_PLANS.starter).toMatchObject({ priceInr: 1699, pricePerCallInr: 2, requestsPerMinute: 60, maxResolution: "1K" }); expect(API_PLANS.scale).toMatchObject({ priceInr: 8499, pricePerCallInr: 5, requestsPerMinute: 600, maxResolution: "2K" }); });
});
