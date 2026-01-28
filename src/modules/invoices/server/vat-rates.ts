export const STANDARD_VAT_BPS_BY_ISO2: Record<string, number> = {
  AT: 2000,
  BE: 2100,
  BG: 2000,
  HR: 2500,
  CY: 1900,
  CZ: 2100,
  DK: 2500,
  EE: 2200,
  FI: 2550,
  FR: 2000,
  DE: 1900,
  GR: 2400,
  HU: 2700,
  IE: 2300,
  IT: 2200,
  LV: 2100,
  LT: 2100,
  LU: 1700,
  MT: 1800,
  NL: 2100,
  PL: 2300,
  PT: 2300,
  RO: 2100,
  SK: 2300,
  SI: 2200,
  ES: 2100,
  SE: 2500,
};

export function resolveVatRateBps(params: {
  sellerCountryISO: string;
  sellerVatRegistered: boolean;
}) {
  if (!params.sellerVatRegistered) return 0;
  const key = params.sellerCountryISO.toUpperCase();
  const rate = STANDARD_VAT_BPS_BY_ISO2[key];
  if (rate == null) {
    throw new Error(`Missing VAT rate for ${key}`);
  }
  return rate;
}
