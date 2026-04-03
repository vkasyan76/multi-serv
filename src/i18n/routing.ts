import type { NextRequest } from "next/server";
import {
  DEFAULT_APP_LANG,
  SUPPORTED_APP_LANGS,
  normalizeToSupported,
  type AppLang,
} from "@/lib/i18n/app-lang";

// Phase 1 routing helpers: keep locale parsing/prefixing centralized for middleware decisions.
export const LOCALES = SUPPORTED_APP_LANGS;
export const DEFAULT_LOCALE = DEFAULT_APP_LANG;
export const LOCALE_COOKIE_NAME = "app_lang";

function normalizePathname(pathname: string) {
  const withSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const collapsed = withSlash.replace(/\/{2,}/g, "/");
  return collapsed || "/";
}

export function isLocaleSegment(seg: string): seg is AppLang {
  const normalized = seg.trim().toLowerCase();
  return (LOCALES as readonly string[]).includes(normalized);
}

export function stripLeadingLocale(pathname: string): {
  lang?: AppLang;
  restPathname: string;
} {
  const normalized = normalizePathname(pathname);
  const parts = normalized.split("/");
  const first = parts[1]?.toLowerCase() ?? "";

  if (!isLocaleSegment(first)) {
    return { lang: undefined, restPathname: normalized };
  }

  const restRaw = `/${parts.slice(2).join("/")}`;
  const rest = normalizePathname(restRaw);
  return { lang: first, restPathname: rest === "/" ? "/" : rest };
}

export function withLocalePrefix(pathname: string, lang: AppLang) {
  const normalized = normalizePathname(pathname);
  const existing = stripLeadingLocale(normalized);
  if (existing.lang) return normalized;
  return normalized === "/" ? `/${lang}` : `/${lang}${normalized}`;
}

export function resolveLocaleFromRequest(
  req: NextRequest,
  cookieName = LOCALE_COOKIE_NAME,
): AppLang {
  const cookieLang = req.cookies.get(cookieName)?.value;
  if (cookieLang) return normalizeToSupported(cookieLang);

  const acceptLanguage = req.headers.get("accept-language") ?? undefined;
  if (acceptLanguage) return normalizeToSupported(acceptLanguage);

  return DEFAULT_LOCALE;
}

export function mirrorLocaleCookie(lang: AppLang) {
  if (typeof document === "undefined") return;

  const secure = process.env.NODE_ENV === "production" ? "; secure" : "";
  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(lang)}; path=/; max-age=31536000; samesite=lax${secure}`;
}
