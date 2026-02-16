import {
  COMMISSION_RATE_BPS_DEFAULT,
  PROMO_RULE_ID_DEFAULT,
} from "@/constants";

export type CommissionContext = "invoice_checkout";
export type CommissionBasis = "net";

export type ComputeCommissionSnapshotInput = {
  tenantId: string;
  basisAmountCents: number;
  currency: string;
  context: CommissionContext;
};

export type CommissionSnapshot = {
  platformFeeRateBps: number;
  platformFeeCents: number;
  platformFeeRuleId: string;
  platformFeeCalculatedAt: string;
  platformFeeBasis: CommissionBasis;
  platformFeeBasisCents: number;
};

// MVP: fee basis is net/subtotal only.
const PLATFORM_FEE_BASIS: CommissionBasis = "net";

// Single choke point for computing the platform fee snapshot.
export function computeCommissionSnapshot(
  input: ComputeCommissionSnapshotInput,
): CommissionSnapshot {
  const basisAmountCents = Math.round(Number(input.basisAmountCents));
  if (!Number.isFinite(basisAmountCents) || basisAmountCents <= 0) {
    throw new Error("Invalid commission basis amount.");
  }

  const rateBps = COMMISSION_RATE_BPS_DEFAULT;
  const feeCents = Math.max(0, Math.round((basisAmountCents * rateBps) / 10000));

  return {
    platformFeeRateBps: rateBps,
    platformFeeCents: feeCents,
    platformFeeRuleId: PROMO_RULE_ID_DEFAULT,
    // Store ISO string to match Payload "date" field expectations.
    platformFeeCalculatedAt: new Date().toISOString(),
    platformFeeBasis: PLATFORM_FEE_BASIS,
    platformFeeBasisCents: basisAmountCents,
  };
}
