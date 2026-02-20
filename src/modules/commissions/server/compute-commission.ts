import "server-only";

import {
  COMMISSION_RATE_BPS_DEFAULT,
  PLATFORM_FEE_BASIS,
  PROMO_RULE_ID_DEFAULT,
} from "@/constants";

export type CommissionContext = "invoice_checkout";
export type CommissionBasis = "net";

export type ComputeCommissionSnapshotInput = {
  tenantId: string;
  basisAmountCents: number;
  currency: string;
  context: CommissionContext;
  rateBps?: number;
  ruleId?: string;
};

export type CommissionSnapshot = {
  platformFeeRateBps: number;
  platformFeeCents: number;
  platformFeeRuleId: string;
  platformFeeCalculatedAt: string;
  platformFeeBasis: CommissionBasis;
  platformFeeBasisCents: number;
};

// Single choke point for computing the platform fee snapshot.
export function computeCommissionSnapshot(
  input: ComputeCommissionSnapshotInput,
): CommissionSnapshot {
  const basisAmountCents = Math.round(Number(input.basisAmountCents));
  if (!Number.isFinite(basisAmountCents) || basisAmountCents <= 0) {
    throw new Error("Invalid commission basis amount.");
  }

  const rateBps =
    typeof input.rateBps === "number" &&
    Number.isFinite(input.rateBps) &&
    Number.isInteger(input.rateBps) &&
    input.rateBps >= 0 &&
    input.rateBps <= 10000
      ? input.rateBps
      : COMMISSION_RATE_BPS_DEFAULT;
  const ruleId =
    typeof input.ruleId === "string" && input.ruleId.trim().length > 0
      ? input.ruleId.trim()
      : PROMO_RULE_ID_DEFAULT;
  const feeCents = Math.max(0, Math.round((basisAmountCents * rateBps) / 10000));

  return {
    platformFeeRateBps: rateBps,
    platformFeeCents: feeCents,
    platformFeeRuleId: ruleId,
    // Store ISO string to match Payload "date" field expectations.
    platformFeeCalculatedAt: new Date().toISOString(),
    platformFeeBasis: PLATFORM_FEE_BASIS,
    platformFeeBasisCents: basisAmountCents,
  };
}
