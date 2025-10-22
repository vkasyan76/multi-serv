// Minimal EU list + helpers (no dependencies, no side-effects)
export const EU_ISO2 = [
  "DE",
  "FR",
  "IT",
  "ES",
  "NL",
  "BE",
  "AT",
  "PL",
  "CZ",
  "SK",
  "HU",
  "RO",
  "BG",
  "HR",
  "SI",
  "GR",
  "PT",
  "DK",
  "SE",
  "FI",
  "LU",
  "MT",
  "CY",
  "EE",
  "LV",
  "LT",
  "IE",
] as const;

export type EuIso2 = (typeof EU_ISO2)[number];

export function isEU(code?: string): code is EuIso2 {
  if (!code) return false;
  return EU_ISO2.includes(code.toUpperCase() as EuIso2);
}
