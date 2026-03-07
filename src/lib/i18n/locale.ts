import { DEFAULT_APP_LANG, type AppLang } from "@/lib/i18n/app-lang";

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
  return { locale, currency: "EUR" };
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
  const country = countryNameFromCode(coords.countryISO, locale);
  if (coords.city) return `${coords.city}, ${country}`;
  if (coords.region) return `${coords.region}, ${country}`;
  return country;
}

export function formatDateForLocale(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {},
  appLang: AppLang = DEFAULT_APP_LANG
) {
  const { locale } = getLocaleAndCurrency(appLang);
  const dateObj = typeof date === "string" ? new Date(date) : date;

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
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale, { month: monthStyle, year: "numeric" });
}

export function formatCurrency(
  amountMajor: number,
  currency?: string,
  appLang: AppLang = DEFAULT_APP_LANG
) {
  const { locale } = getLocaleAndCurrency(appLang);
  const cur = (currency ?? "EUR").toUpperCase();

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: cur,
    }).format(amountMajor);
  } catch {
    return `${amountMajor.toFixed(2)} ${cur}`;
  }
}
