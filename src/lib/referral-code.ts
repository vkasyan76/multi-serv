// Canonical referral-code normalization shared by auth/referral flows.
export const REFERRAL_CODE_RE = /^[A-Z0-9_-]{3,64}$/;

export function normalizeReferralCode(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const normalized = raw.trim().replace(/\s+/g, "-").toUpperCase();
  return REFERRAL_CODE_RE.test(normalized) ? normalized : null;
}
