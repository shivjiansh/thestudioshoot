import { API_PLANS, CONSUMER_PLANS } from "@/config/plans";

export function isActiveSubscription(status: unknown): status is "active" {
  return status === "active";
}

export function canGenerateForConsumer(planId: string, subscriptionStatus: unknown): boolean {
  const plan = CONSUMER_PLANS[planId] ?? CONSUMER_PLANS.free;
  return plan.aiGeneration && isActiveSubscription(subscriptionStatus);
}

export function hasActiveApiPlan(planId: string, subscriptionStatus: unknown): boolean {
  return Object.prototype.hasOwnProperty.call(API_PLANS, planId) && isActiveSubscription(subscriptionStatus);
}
