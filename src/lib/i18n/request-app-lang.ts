import {
  DEFAULT_APP_LANG,
  normalizeToSupported,
  type AppLang,
} from "@/lib/i18n/app-lang";
import { LOCALE_COOKIE_NAME } from "@/i18n/routing";

type HeaderLike = Headers | Record<string, string | undefined>;

function getHeader(headers: HeaderLike, name: string): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  const match = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );

  return match?.[1];
}

function readCookieValue(
  cookieHeader: string | undefined,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;

  const part = cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`));

  if (!part) return undefined;

  const raw = part.slice(name.length + 1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function resolveAppLangFromHeaders(headers: HeaderLike): AppLang {
  const headerLang = getHeader(headers, "x-app-lang")?.trim();
  const cookieLang = readCookieValue(
    getHeader(headers, "cookie"),
    LOCALE_COOKIE_NAME,
  );
  const acceptLanguage = getHeader(headers, "accept-language");

  return normalizeToSupported(
    headerLang || cookieLang || acceptLanguage || DEFAULT_APP_LANG,
  );
}
