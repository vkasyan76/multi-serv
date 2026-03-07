import { Language } from "@googlemaps/google-maps-services-js";
import type {
  UserCoordinates,
  SelectedLocation,
} from "@/modules/tenants/types";
import {
  DEFAULT_APP_LANG,
  normalizeToSupported,
  SUPPORTED_LANGUAGES,
  type AppLang,
} from "@/lib/i18n/app-lang";

// IP Geolocation helper function using ipapi.co service
// This provides accurate, production-ready IP geolocation with EU country detection
// Free tier available: https://ipapi.co/
export async function getLocationFromIP(
  ip: string
): Promise<UserCoordinates | undefined> {
  try {
    const isProd = process.env.NODE_ENV === "production";
    if (!isProd) console.log("IP Geolocation - fetching location");

    // Timeout-hardened fetch
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      if (!isProd) console.error("IP geolocation non-200:", response.status);
      return undefined;
    }
    const data = await response.json();

    if (data?.error) {
      if (!isProd) console.error("IP geolocation error:", data.reason ?? data);
      return undefined;
    }

    // Check if it's an EU country
    const euCountries = [
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
    ];

    if (data.country_code && euCountries.includes(data.country_code)) {
      const lat = Number(data.latitude);
      const lng = Number(data.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        if (!isProd)
          console.error("IP geolocation missing/invalid lat/lng:", data);
        return undefined;
      }
      const result = {
        lat,
        lng,
        city: data.city,
        countryISO: data.country_code,
        countryName: data.country_name,
        region: data.region,
        postalCode: null,
        street: null,
        streetNumber: null,
        ipDetected: true,
        manuallySet: false,
      };
      if (!isProd) console.log("IP Geolocation - extracted EU location");
      return result;
    }

    if (!isProd)
      console.log(
        "IP Geolocation - IP not from EU country:",
        data.country_code
      );
    return undefined;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.log("IP geolocation failed:", error);
    }
    return undefined;
  }
}

// Helper functions for robust address parsing from Google Places API
export function extractCityFromAddress(address: string): string {
  // Try to extract city from Google Places formatted address
  // Common patterns: "City Name, Region, Country" or "Street, City, Country"
  const parts = address.split(",").map((part) => part.trim());

  // If we have at least 2 parts, the city is usually the second part
  // (first part is often street address, last part is country)
  if (parts.length >= 2) {
    // Skip the first part (street) and last part (country), city is usually in the middle
    const cityPart = parts[1];
    if (cityPart && cityPart.length > 0) {
      return cityPart;
    }
  }

  // Fallback: use first part if it looks like a city name
  if (parts.length > 0) {
    const firstPart = parts[0];
    // If first part doesn't contain numbers, it might be a city
    if (firstPart && !/\d/.test(firstPart)) {
      return firstPart;
    }
  }

  return "";
}

export function extractRegionFromAddress(address: string): string {
  const parts = address.split(",").map((part) => part.trim());

  // Region is usually the third part in "City, Region, Country" format
  if (parts.length >= 3) {
    const regionPart = parts[2];
    if (regionPart && regionPart.length > 0) {
      return regionPart;
    }
  }

  // Fallback: try to find a part that looks like a region/state
  for (let i = 1; i < parts.length - 1; i++) {
    const part = parts[i];
    if (
      part &&
      part.length > 0 &&
      !part.includes("Street") &&
      !part.includes("Road")
    ) {
      return part;
    }
  }

  return "";
}

// Helper function to extract IP from request headers (handles proxy scenarios)
export function extractIPFromHeaders(headers: Headers): string {
  // Try multiple IP headers in order of preference
  const possibleIPs = [
    headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    headers.get("x-real-ip"),
    headers.get("x-client-ip"),
    headers.get("cf-connecting-ip"), // Cloudflare
    headers.get("x-forwarded"),
    headers.get("forwarded")?.split(",")[0]?.split("=")[1]?.trim(),
  ].filter(Boolean);

  return possibleIPs[0] || "127.0.0.1";
}

// Helper function to check if coordinates are valid (zero-friendly)
export function hasValidCoordinates(
  coordinates: unknown
): coordinates is UserCoordinates {
  if (!coordinates || typeof coordinates !== "object") return false;
  const coords = coordinates as Record<string, unknown>;
  return Number.isFinite(coords.lat) && Number.isFinite(coords.lng);
}

// Helper function to replace coordinates completely instead of merging
export function replaceCoordinates(
  newCoords: Partial<UserCoordinates>,
  isManuallySet: boolean = false
): UserCoordinates {
  if (newCoords.lat == null || newCoords.lng == null) {
    throw new Error("replaceCoordinates requires both lat and lng.");
  }
  return {
    // Use new coordinates directly - no preservation of old data
    lat: newCoords.lat,
    lng: newCoords.lng,
    city: newCoords.city ?? null,
    countryISO: newCoords.countryISO ?? null,
    countryName: newCoords.countryName ?? null,
    region: newCoords.region ?? null,
    postalCode: newCoords.postalCode ?? null,
    street: newCoords.street ?? null,
    streetNumber: newCoords.streetNumber ?? null,
    ipDetected: !isManuallySet,
    manuallySet: isManuallySet,
  };
}

// Extract structured address components from Google Place Details
export function extractAddressComponents(
  components: Array<{
    types: string[];
    long_name?: string;
    short_name?: string;
  }>
): Partial<SelectedLocation> {
  const get = (type: string) =>
    components.find((comp) => comp.types.includes(type));

  const city =
    get("locality")?.long_name ||
    get("postal_town")?.long_name ||
    get("sublocality")?.long_name;

  const region =
    get("administrative_area_level_1")?.short_name ||
    get("administrative_area_level_2")?.short_name;

  // Enhanced street extraction - properly concatenate route and street number
  const route = get("route")?.long_name;
  const streetNumber = get("street_number")?.long_name;
  const street =
    route && streetNumber ? `${route} ${streetNumber}` : route || undefined;

  return {
    city,
    region,
    postalCode: get("postal_code")?.long_name,
    street,
    streetNumber,
    countryISO: get("country")?.short_name,
    countryName: get("country")?.long_name,
  };
}

export function extractCountry(address: string): string {
  // const parts = address.split(",").map((part) => part.trim());
  // return parts[parts.length - 1] || "";
  const parts = address.split(",").map((part) => part.trim());
  // Filter out empty parts and postal codes (basic heuristic)
  const nonEmptyParts = parts.filter(
    (part) => part.length > 0 && !/^\d{2,6}(-\d)?$/.test(part)
  );
  return nonEmptyParts[nonEmptyParts.length - 1] || "";
}

// Map country names to ISO country codes for phone number formatting
export function getCountryCodeFromName(countryName: string): string {
  const countryMap: Record<string, string> = {
    // EU Member States
    Germany: "DE",
    Deutschland: "DE",
    France: "FR",
    Italy: "IT",
    Italia: "IT",
    Spain: "ES",
    Espana: "ES",
    Netherlands: "NL",
    Nederland: "NL",
    Belgium: "BE",
    Belgique: "BE",
    Austria: "AT",
    Osterreich: "AT",
    Poland: "PL",
    Polska: "PL",
    "Czech Republic": "CZ",
    Czechia: "CZ",
    Slovakia: "SK",
    Slovensko: "SK",
    Hungary: "HU",
    Magyarorszag: "HU",
    Romania: "RO",
    RomaniaRO: "RO",
    Bulgaria: "BG",
    Balgariya: "BG",
    Croatia: "HR",
    Hrvatska: "HR",
    Slovenia: "SI",
    Slovenija: "SI",
    Greece: "GR",
    Ellada: "GR",
    Portugal: "PT",
    Denmark: "DK",
    Danmark: "DK",
    Sweden: "SE",
    Sverige: "SE",
    Finland: "FI",
    Suomi: "FI",
    Luxembourg: "LU",
    Letzebuerg: "LU",
    Malta: "MT",
    Cyprus: "CY",
    Kypros: "CY",
    Estonia: "EE",
    Eesti: "EE",
    Latvia: "LV",
    Latvija: "LV",
    Lithuania: "LT",
    Lietuva: "LT",
    Ireland: "IE",
    Eire: "IE",

    // Non-EU European countries
    "United Kingdom": "GB",
    UK: "GB",
    "Great Britain": "GB",
    England: "GB",
    Scotland: "GB",
    Wales: "GB",
    "Northern Ireland": "GB",
    Switzerland: "CH",
    Schweiz: "CH",
    Suisse: "CH",
    Ukraine: "UA",
    Ukraina: "UA",
  };

  // Normalize country name for matching
  const normalizedCountry = countryName.trim().toLowerCase();

  // Try exact match first
  for (const [country, code] of Object.entries(countryMap)) {
    if (country.toLowerCase() === normalizedCountry) {
      return code;
    }
  }

  // Try partial match for common variations
  for (const [country, code] of Object.entries(countryMap)) {
    if (
      country.toLowerCase().includes(normalizedCountry) ||
      normalizedCountry.includes(country.toLowerCase())
    ) {
      return code;
    }
  }

  // Default to Germany if no match found
  return "DE";
}

// Google Maps language detection (CLIENT ONLY) - used only for Maps,
// not for your app UI language.

// ---- Language + appLang helpers ----

// Re-export shared app language definitions for backward compatibility.
// New code should prefer direct imports from `@/lib/i18n/app-lang`.
export {
  DEFAULT_APP_LANG,
  normalizeToSupported,
  SUPPORTED_LANGUAGES,
  type AppLang,
};

export function detectLanguage(): Language {
  if (typeof navigator === "undefined") return Language.en;
  const langCode = navigator.language.slice(0, 2);
  const mapped = (Language as Record<string, Language>)[langCode];
  return mapped ?? Language.en;
}

/**
 * CLIENT-ONLY: derive initial AppLang from browser language.
 * Use this ONLY in client components (e.g. useState(() => getInitialLanguage())).
 */
export function getInitialLanguage(): AppLang {
  if (typeof window === "undefined") return DEFAULT_APP_LANG;

  const htmlLang = document.documentElement.lang?.trim();
  if (htmlLang) return normalizeToSupported(htmlLang);

  const navLang = navigator.languages?.[0] ?? navigator.language;
  return normalizeToSupported(navLang || DEFAULT_APP_LANG);
}

/**
 * SERVER-ONLY helper: derive AppLang from Accept-Language header.
 * This is what lets a first-time German user see DE *on the first paint*.
 */
// src/modules/profile/location-utils.ts

export function getAppLangFromHeaders(headers: Pick<Headers, "get">): AppLang {
  const acceptLanguage = headers.get("accept-language") || undefined;
  return normalizeToSupported(acceptLanguage);
}

// ---- Locale + formatting ----

// Phase 4: keep legacy import path stable while moving canonical helpers to src/lib/i18n/locale.ts.
export {
  mapAppLangToLocale,
  getLocaleAndCurrency,
  countryNameFromCode,
  formatLocationFromCoords,
  formatDateForLocale,
  formatNumberForLocale,
  formatIntegerForLocale,
  formatOneDecimalForLocale,
  formatMonthYearForLocale,
  formatCurrency,
} from "@/lib/i18n/locale";
