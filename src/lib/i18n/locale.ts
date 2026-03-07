import { WALLET_CURRENCY } from "@/constants";
import { DEFAULT_APP_LANG, type AppLang } from "@/lib/i18n/app-lang";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseLocaleDateInput(value: Date | string): Date {
  if (value instanceof Date) return value;

  // Preserve local calendar day for plain date-only strings.
  if (DATE_ONLY_RE.test(value)) {
    const parts = value.split("-");
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    return new Date(year, month - 1, day);
  }

  return new Date(value);
}

// Phase 4: canonical locale/formatting helpers; keep behavior identical to legacy location-utils exports.
export function mapAppLangToLocale(appLang: AppLang): string {
  switch (appLang) {
    case "de":
      return "de-DE";
    case "fr":
      return "fr-FR";
    case "it":
      return "it-IT";
    case "es":
      return "es-ES";
    case "pt":
      return "pt-PT";
    case "en":
    default:
      return "en-US";
  }
}

export function getLocaleAndCurrency(appLang: AppLang = DEFAULT_APP_LANG) {
  const locale = mapAppLangToLocale(appLang);
  return { locale, currency: WALLET_CURRENCY.toUpperCase() };
}

export function countryNameFromCode(code?: string, locale = "en"): string {
  if (!code) return "";
  try {
    // Node and modern browsers support this; fall back to code if unavailable.
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function formatLocationFromCoords(
  coords?: { city?: string; region?: string; countryISO?: string },
  locale = "en"
): string {
  if (!coords) return "";
  const primary = coords.city ?? coords.region;
  const country = coords.countryISO
    ? countryNameFromCode(coords.countryISO, locale)
    : "";
  return [primary, country].filter(Boolean).join(", ");
}

export function formatDateForLocale(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {},
  appLang: AppLang = DEFAULT_APP_LANG
) {
  const { locale } = getLocaleAndCurrency(appLang);
  const dateObj = parseLocaleDateInput(date);

  return dateObj.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  });
}

export function formatNumberForLocale(
  value: number,
  opts: Intl.NumberFormatOptions = {},
  appLang: AppLang = DEFAULT_APP_LANG
) {
  const { locale } = getLocaleAndCurrency(appLang);

  // Extract and normalize.
  let { minimumFractionDigits, maximumFractionDigits } = opts;
  const rest = { ...opts };
  delete rest.minimumFractionDigits;
  delete rest.maximumFractionDigits;

  // Default only if both are missing (legacy behavior: one decimal place).
  if (minimumFractionDigits == null && maximumFractionDigits == null) {
    minimumFractionDigits = 1;
    maximumFractionDigits = 1;
  }

  // Mirror single bound to avoid Intl range conflicts.
  if (minimumFractionDigits == null && maximumFractionDigits != null) {
    minimumFractionDigits = Math.max(0, Math.min(maximumFractionDigits, 20));
  }
  if (maximumFractionDigits == null && minimumFractionDigits != null) {
    maximumFractionDigits = Math.max(0, Math.min(minimumFractionDigits, 20));
  }

  // Clamp if max < min.
  if (
    minimumFractionDigits != null &&
    maximumFractionDigits != null &&
    maximumFractionDigits < minimumFractionDigits
  ) {
    minimumFractionDigits = maximumFractionDigits;
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
    ...rest,
  }).format(value);
}

export const formatIntegerForLocale = (
  n: number,
  appLang: AppLang = DEFAULT_APP_LANG
) =>
  formatNumberForLocale(
    n,
    { minimumFractionDigits: 0, maximumFractionDigits: 0 },
    appLang
  );

export const formatOneDecimalForLocale = (
  n: number,
  appLang: AppLang = DEFAULT_APP_LANG
) =>
  formatNumberForLocale(
    n,
    { minimumFractionDigits: 1, maximumFractionDigits: 1 },
    appLang
  );

export function formatMonthYearForLocale(
  date: Date | string,
  monthStyle: "short" | "long" = "short",
  appLang: AppLang = DEFAULT_APP_LANG
) {
  const { locale } = getLocaleAndCurrency(appLang);
  const d = parseLocaleDateInput(date);
  return d.toLocaleDateString(locale, { month: monthStyle, year: "numeric" });
}

export function formatCurrency(
  amountMajor: number,
  currency?: string,
  appLang: AppLang = DEFAULT_APP_LANG
) {
  const { locale } = getLocaleAndCurrency(appLang);
  const cur = (currency ?? WALLET_CURRENCY).toUpperCase();

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: cur,
    }).format(amountMajor);
  } catch {
    return `${amountMajor.toFixed(2)} ${cur}`;
  }
}
