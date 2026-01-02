// src/modules/legal/cookies/consent.ts
import { COOKIE_CONSENT_COOKIE, COOKIE_CONSENT_VERSION } from "@/constants";

export type CookieConsentPrefs = {
  analytics: boolean;
  advertising: boolean;
};

export type CookieConsent = {
  v: string; // version
  at: string; // ISO timestamp
  prefs: CookieConsentPrefs;
};

export const DEFAULT_COOKIE_PREFS: CookieConsentPrefs = {
  analytics: false,
  advertising: false,
};

const MAX_AGE_DAYS = 180;

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function isValidConsent(
  c: CookieConsent | null | undefined
): c is CookieConsent {
  if (!c) return false;
  if (c.v !== COOKIE_CONSENT_VERSION) return false;
  if (!c.at) return false;
  const d = new Date(c.at);
  if (!isFinite(d.getTime())) return false;
  if (!c.prefs) return false;
  if (typeof c.prefs.analytics !== "boolean") return false;
  if (typeof c.prefs.advertising !== "boolean") return false;
  return true;
}

export function parseConsentValue(
  raw: string | undefined | null
): CookieConsent | null {
  if (!raw) return null;
  const parsed = safeJsonParse<CookieConsent>(decodeURIComponent(raw));
  return isValidConsent(parsed) ? parsed : null;
}

export function shouldShowCookieBanner(
  rawCookieValue?: string | null
): boolean {
  const c = parseConsentValue(rawCookieValue ?? undefined);
  return !isValidConsent(c);
}

/**
 * CLIENT HELPERS
 * These are intentionally runtime-guarded so this module can be imported server-side.
 */

function getClientCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return p.slice(name.length + 1);
  }
  return null;
}

function getCookieDomainAttr(): string {
  // IMPORTANT: do NOT set Domain on localhost (it breaks).
  // In production, you want a root-domain cookie so it works on *.infinisimo.com.
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!root) return "";
  // If someone accidentally sets "localhost" as root domain, still avoid Domain.
  if (root.includes("localhost")) return "";
  return `; Domain=.${root.replace(/^\./, "")}`;
}

export function readClientConsent(): CookieConsent | null {
  const raw = getClientCookieValue(COOKIE_CONSENT_COOKIE);
  return parseConsentValue(raw);
}

export function writeClientConsent(prefs: CookieConsentPrefs): CookieConsent {
  const consent: CookieConsent = {
    v: COOKIE_CONSENT_VERSION,
    at: new Date().toISOString(),
    prefs: {
      analytics: !!prefs.analytics,
      advertising: !!prefs.advertising,
    },
  };

  if (typeof document !== "undefined") {
    const maxAge = MAX_AGE_DAYS * 24 * 60 * 60;
    const secure =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "; Secure"
        : "";

    // SameSite=Lax is generally correct for same-site subdomains
    // (your apex + tenant subdomains are same-site).
    const value = encodeURIComponent(JSON.stringify(consent));

    document.cookie =
      `${COOKIE_CONSENT_COOKIE}=${value}` +
      `; Path=/` +
      getCookieDomainAttr() +
      `; Max-Age=${maxAge}` +
      `; SameSite=Lax` +
      secure;
  }

  return consent;
}

export function clearClientConsent(): void {
  if (typeof document === "undefined") return;

  // Expire now (also try with/without Domain to cover edge cases)
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";

  document.cookie =
    `${COOKIE_CONSENT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax` + secure;

  const domainAttr = getCookieDomainAttr();
  if (domainAttr) {
    document.cookie =
      `${COOKIE_CONSENT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax` +
      domainAttr +
      secure;
  }
}
