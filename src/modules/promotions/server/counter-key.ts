export type FirstNScope = "global" | "per_tenant";

export function buildPromotionCounterKey(input: {
  promotionId: string;
  firstNScope: FirstNScope;
  tenantId?: string | null;
}): string {
  const promotionId = input.promotionId?.trim();
  if (!promotionId) throw new Error("promotionId is required.");

  if (input.firstNScope === "global") {
    return `promo:${promotionId}:global`;
  }

  // Fail fast on unexpected runtime values from untyped callers.
  if (input.firstNScope !== "per_tenant") {
    throw new Error(`Unknown firstNScope: ${String(input.firstNScope)}`);
  }

  const tenantId = input.tenantId?.trim();
  if (!tenantId) {
    throw new Error("tenantId is required for per_tenant counters.");
  }

  return `promo:${promotionId}:tenant:${tenantId}`;
}

