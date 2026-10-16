import { describe, expect, it } from "vitest";
import { canGenerateForConsumer, hasActiveApiPlan, isActiveSubscription } from "../../src/lib/entitlements/access";

describe("server-side entitlement predicates", () => {
  it("requires an exact active provider-synced subscription status", () => {
    expect(isActiveSubscription("active")).toBe(true);
    expect(isActiveSubscription("authenticated")).toBe(false);
    expect(isActiveSubscription("cancelled")).toBe(false);
    expect(isActiveSubscription(undefined)).toBe(false);
  });
  it("blocks Free-plan AI even if a bad status is supplied", () => {
    expect(canGenerateForConsumer("free", "active")).toBe(false);
  });
  it("requires a known paid plan and active subscription", () => {
    expect(canGenerateForConsumer("pro", "active")).toBe(true);
    expect(canGenerateForConsumer("pro", "cancelled")).toBe(false);
    expect(hasActiveApiPlan("starter", "active")).toBe(true);
    expect(hasActiveApiPlan("scale", "paused")).toBe(false);
    expect(hasActiveApiPlan("toString", "active")).toBe(false);
    expect(hasActiveApiPlan("__proto__", "active")).toBe(false);
  });
});
