// src/modules/checkout/utils/cart-utils.ts

export type RatePick = {
  hourlyRate?: number | string | null;
  hourly_rate?: number | string | null;
  ratePerHour?: number | string | null;
  pricePerHour?: number | string | null;
};

/**
 * Safely read a tenant's hourly rate and return value in CENTS.
 * Accepts number or numeric string. Falls back to 0 when missing/invalid.
 */
export function getHourlyRateCents(t: unknown): number {
  if (!t || typeof t !== "object") return 0;
  const r = t as RatePick;

  const raw =
    r.hourlyRate ?? r.hourly_rate ?? r.ratePerHour ?? r.pricePerHour ?? 0;

  const n =
    typeof raw === "string"
      ? parseFloat(raw)
      : typeof raw === "number"
        ? raw
        : 0;

  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
