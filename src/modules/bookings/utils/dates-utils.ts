// src/modules/bookings/utils/dates-utils.ts
import { format, parse, startOfWeek as dfnsStartOfWeek, getDay } from "date-fns";
import { dateFnsLocalizer, type Formats } from "react-big-calendar";

// ===== EU ONLY date-fns locales (add more EU locales as needed) =====
import {
  enGB, de, fr, it, es, nl, da, fi, cs, sk, sl, hr, bg, el, hu, ro, pl, lt, lv, et, pt
} from "date-fns/locale";
import type { Locale } from "date-fns";

// Key set determines what `culture` values we'll accept.
export const SUPPORTED_LOCALES: Record<string, Locale> = {
  "en-GB": enGB,
  de, fr, es, it,
  "pt-PT": pt,
  nl, da, fi,
  cs, sk, sl, hr,
  bg, el, hu, pl, ro,
  lt, lv, et,
};

export type CultureCode = keyof typeof SUPPORTED_LOCALES;

/**
 * If you have src/modules/profile/location-utils.ts exposing getLocaleAndCurrency(),
 * you can pass it here to stay consistent with the rest of the app.
 */
export function getCultureFromProfile(
  getLocaleAndCurrency?: () => { locale?: string } | undefined
): CultureCode {
  const loc =
    getLocaleAndCurrency?.()?.locale ??
    (typeof navigator !== "undefined" ? navigator.language : undefined);
  return resolveCulture(loc);
}

/** Rolling week configuration (shared across components) */
export const rolling = {
  useRollingWeek: false,
  anchor: new Date(),
};

/** One shared localizer with rolling week support; we select the active language via <Calendar culture=... /> */
export const rbcLocalizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date, options?: { locale?: Locale }) =>
    rolling.useRollingWeek ? rolling.anchor : dfnsStartOfWeek(date, options),
  getDay,
  locales: SUPPORTED_LOCALES,
});

/** Normalize culture for consistent formatting */
function resolveCulture(culture?: string): CultureCode {
  if (!culture) return "en-GB";
  const [base] = culture.split(/[-_]/);
  if (base === "en") return "en-GB";
  if (base === "pt") return "pt-PT";
  // Prefer exact key if present, else fall back to base if supported, else default
  if (culture in SUPPORTED_LOCALES) return culture as CultureCode;
  if (base && base in SUPPORTED_LOCALES) return base as CultureCode;
  return "en-GB";
}

/** RBC formats: localized headers, weekday labels, time gutter, event time ranges. */
export function rbcFormats(): Formats {
  return {
    dayHeaderFormat: (date, culture) => {
      const fmt = new Intl.DateTimeFormat(resolveCulture(culture), {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      return fmt.format(date as Date);
    },

    dayRangeHeaderFormat: ({ start, end }, culture) => {
      const fmt = new Intl.DateTimeFormat(resolveCulture(culture), {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      return `${fmt.format(start as Date)} — ${fmt.format(end as Date)}`;
    },

    weekdayFormat: (date, culture) => {
      const fmt = new Intl.DateTimeFormat(resolveCulture(culture), {
        weekday: "short",
      });
      return fmt.format(date as Date);
    },

    timeGutterFormat: (date, culture) => {
      const fmt = new Intl.DateTimeFormat(resolveCulture(culture), {
        hour: "2-digit",
        minute: "2-digit",
      });
      return fmt.format(date as Date);
    },

    eventTimeRangeFormat: ({ start, end }, culture) => {
      const t = new Intl.DateTimeFormat(resolveCulture(culture), {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `${t.format(start as Date)} – ${t.format(end as Date)}`;
    },
  };
}

/** Intl formatters for tooltips, badges, etc. */
export function intlFormatters(culture: string) {
  const dateFmt = new Intl.DateTimeFormat(culture, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat(culture, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return { dateFmt, timeFmt };
}
