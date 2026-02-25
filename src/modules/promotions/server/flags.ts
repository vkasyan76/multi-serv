import "server-only";

function isTruthyFlag(value: string | undefined): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

// Guardrail policy:
// - Missing env should be safe by default (OFF).
// - Only explicit truthy values ("1"/"true") enable behavior.
// This prevents accidental promo activation in environments where env vars
// were not configured yet.
export const PROMOTIONS_ENABLED = isTruthyFlag(
  process.env.PROMOTIONS_ENABLED,
);
export const PROMOTIONS_LOGS_ENABLED = isTruthyFlag(
  process.env.PROMOTIONS_LOGS,
);

export function promotionDecisionLog(
  event: string,
  payload: Record<string, unknown>,
) {
  if (!PROMOTIONS_LOGS_ENABLED) return;
  console.info(`[promotions] ${event}`, payload);
}
