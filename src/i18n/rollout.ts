import {
  LAUNCHED_APP_LANGS,
  SUPPORTED_APP_LANGS,
  type AppLang,
} from "@/lib/i18n/app-lang";
export { LAUNCHED_APP_LANGS };

// Phase 3 (Commit 4): rollout knobs used by i18n-check.ts and CI.
// Phase 3 governance: CI blocks only on launched locales.
// Required namespaces that must exist for each launched locale.
export const REQUIRED_NAMESPACES = [
  "common",
  "bookings",
  "checkout",
  "tenantPage",
  "profile",
  "finance",
  "dashboard",
  "orders",
  "reviews",
  "legalTerms",
] as const;

export type RequiredNamespace = (typeof REQUIRED_NAMESPACES)[number];

export function assertLaunchedLocalesAreSupported() {
  const supported = new Set<AppLang>(SUPPORTED_APP_LANGS);
  const invalid = LAUNCHED_APP_LANGS.filter((lang) => !supported.has(lang));

  if (invalid.length > 0) {
    throw new Error(
      `[i18n-check] Unsupported launched locales: ${invalid.join(", ")}`
    );
  }
}
