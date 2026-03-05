// Canonical app-language source used across schema, collections, UI, and APIs.
export const SUPPORTED_APP_LANGS = [
  "en",
  "de",
  "fr",
  "it",
  "es",
  "pt",
] as const;

export type AppLang = (typeof SUPPORTED_APP_LANGS)[number];

export const DEFAULT_APP_LANG: AppLang = "en";

export const SUPPORTED_LANGUAGES: Array<{ code: AppLang; label: string }> = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
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
