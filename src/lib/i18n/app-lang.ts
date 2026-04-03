// Canonical app-language source used across schema, collections, UI, and APIs.
export const SUPPORTED_APP_LANGS = [
  "en",
  "de",
  "fr",
  "it",
  "es",
  "pt",
  "pl",
  "ro",
  "uk",
] as const;

export type AppLang = (typeof SUPPORTED_APP_LANGS)[number];

// Current rollout: all supported app languages are launched.
export const LAUNCHED_APP_LANGS = SUPPORTED_APP_LANGS;

export const DEFAULT_APP_LANG: AppLang = "en";

export const SUPPORTED_LANGUAGES: Array<{
  code: AppLang;
  label: string;
  countryCode: string;
}> = [
  // Keep flag metadata in the canonical locale registry so UI surfaces do not
  // grow a second per-language lookup table.
  { code: "en", label: "English", countryCode: "GB" },
  { code: "de", label: "Deutsch", countryCode: "DE" },
  { code: "fr", label: "Fran\u00e7ais", countryCode: "FR" },
  { code: "it", label: "Italiano", countryCode: "IT" },
  { code: "es", label: "Espa\u00f1ol", countryCode: "ES" },
  { code: "pt", label: "Portugu\u00eas", countryCode: "PT" },
  { code: "pl", label: "Polski", countryCode: "PL" },
  { code: "ro", label: "Rom\u00e2n\u0103", countryCode: "RO" },
  { code: "uk", label: "\u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430", countryCode: "UA" },
];

export function normalizeToSupported(code?: string): AppLang {
  if (!code) return DEFAULT_APP_LANG;

  // Accept browser/header variants like "de-DE,de;q=0.9" or "EN_us".
  const short = (code.split(",")[0]?.split(/[-_]/)[0] ?? code)
    .trim()
    .toLowerCase();
  return (SUPPORTED_APP_LANGS as readonly string[]).includes(short)
    ? (short as AppLang)
    : DEFAULT_APP_LANG;
}
