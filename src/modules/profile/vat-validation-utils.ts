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

// NEW: mirror VIES behavior — strip country code & separators
export const normalizeVat = (countryISO: string, raw: string) => {
  const iso = (countryISO || "").toUpperCase().slice(0, 2);
  let n = (raw || "").toUpperCase().replace(/[\s.\-]/g, "");
  if (n.startsWith(iso)) n = n.slice(iso.length);
  return { iso, vat: n };
};

export const composeVatWithIso = (iso: string, vat: string) =>
  `${iso}${vat}`.toUpperCase();

// one-liner for equality checks
export const fullNormalize = (countryISO: string, raw?: string) => {
  const { iso, vat } = normalizeVat(countryISO, raw || "");
  return composeVatWithIso(iso, vat);
};
