/**
 * Billing module types
 * Central type definitions for the subscription billing domain
 */

import { PlanTier, SubStatus, BillingCycle } from "@prisma/client";

export type { PlanTier, SubStatus, BillingCycle };

export const FEATURE_FLAGS = [
  "AI_REPORTS",
  "DECISION_EXPORT",
  "API_ACCESS",
  "CUSTOM_TYPES",
  "AUDIT_LOG",
  "SSO",
] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

// A feature is either unconditionally on/off, or gated by a monthly/total count limit.
export type FeatureAccess = boolean | number;

export interface PlanLimits {
  minSeats: number;
  maxSeats: number | null; // null = unlimited (Enterprise)
  pricePerSeatMonthly: number | null; // null = not sold self-serve via Stripe
  pricePerSeatAnnual: number | null;
  minimumMonthlyCharge: number | null;
  features: Record<FeatureFlag, FeatureAccess>;
}

// Pricing per BILLING.md — Free / Growth / Scale / Enterprise.
export const PLAN_CONFIG: Record<PlanTier, PlanLimits> = {
  FREE: {
    minSeats: 0,
    maxSeats: 3,
    pricePerSeatMonthly: 0,
    pricePerSeatAnnual: 0,
    minimumMonthlyCharge: 0,
    features: {
      AI_REPORTS: 3,
      DECISION_EXPORT: false,
      API_ACCESS: false,
      CUSTOM_TYPES: 5,
      AUDIT_LOG: false,
      SSO: false,
    },
  },
  GROWTH: {
    minSeats: 4,
    maxSeats: 15,
    pricePerSeatMonthly: 15,
    pricePerSeatAnnual: 150,
    minimumMonthlyCharge: 60,
    features: {
      AI_REPORTS: true,
      DECISION_EXPORT: true,
      API_ACCESS: true,
      CUSTOM_TYPES: true,
      AUDIT_LOG: false,
      SSO: false,
    },
  },
  SCALE: {
    minSeats: 16,
    maxSeats: 50,
    pricePerSeatMonthly: 12,
    pricePerSeatAnnual: 120,
    minimumMonthlyCharge: 192,
    features: {
      AI_REPORTS: true,
      DECISION_EXPORT: true,
      API_ACCESS: true,
      CUSTOM_TYPES: true,
      AUDIT_LOG: true,
      SSO: false,
    },
  },
  ENTERPRISE: {
    minSeats: 51,
    maxSeats: null,
    pricePerSeatMonthly: null,
    pricePerSeatAnnual: null,
    minimumMonthlyCharge: null,
    features: {
      AI_REPORTS: true,
      DECISION_EXPORT: true,
      API_ACCESS: true,
      CUSTOM_TYPES: true,
      AUDIT_LOG: true,
      SSO: true,
    },
  },
};

const PLAN_ORDER: PlanTier[] = ["FREE", "GROWTH", "SCALE", "ENTERPRISE"];

// The next plan up from `plan` — used to tell the caller what to upgrade to.
// Enterprise has nothing above it (handled outside Stripe).
export function nextPlanAbove(plan: PlanTier): PlanTier | undefined {
  const index = PLAN_ORDER.indexOf(plan);
  return PLAN_ORDER[index + 1];
}

export class SeatLimitExceededError extends Error {
  constructor(
    public currentPlan: PlanTier,
    public upgradeRequired: PlanTier | undefined,
    public limit: number,
  ) {
    super(`Your plan allows up to ${limit} members. Upgrade to add more.`);
    this.name = "SeatLimitExceededError";
  }
}

export class FeatureLimitExceededError extends Error {
  constructor(
    public feature: FeatureFlag,
    message: string,
  ) {
    super(message);
    this.name = "FeatureLimitExceededError";
  }
}

export interface SeatCheckResult {
  allowed: boolean;
  reason?: string;
  currentPlan: PlanTier;
  limit?: number;
  upgradeRequired?: PlanTier;
}

export interface BillingSummary {
  plan: PlanTier;
  status: SubStatus;
  billingCycle: BillingCycle;
  seatCount: number;
  seatLimit: number | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  features: Record<FeatureFlag, FeatureAccess>;
  stripeCustomerId: string | null;
}

export interface PlanCatalogEntry {
  plan: PlanTier;
  minSeats: number;
  maxSeats: number | null;
  pricePerSeatMonthly: number | null;
  pricePerSeatAnnual: number | null;
  minimumMonthlyCharge: number | null;
  features: Record<FeatureFlag, FeatureAccess>;
}

export interface CheckoutInput {
  plan: PlanTier;
  billingCycle: BillingCycle;
  successUrl: string;
  cancelUrl: string;
}

export interface UpgradePreview {
  plan: PlanTier;
  billingCycle: BillingCycle;
  seatCount: number;
  amountDue: number;
  currency: string;
  prorationDate: string | null;
}
