import { Language } from "@googlemaps/google-maps-services-js";

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
    "Germany": "DE",
    "Deutschland": "DE",
    "France": "FR",
    "Italy": "IT",
    "Italia": "IT",
    "Spain": "ES",
    "España": "ES",
    "Netherlands": "NL",
    "Nederland": "NL",
    "Belgium": "BE",
    "België": "BE",
    "Austria": "AT",
    "Österreich": "AT",
    "Poland": "PL",
    "Polska": "PL",
    "Czech Republic": "CZ",
    "Czechia": "CZ",
    "Slovakia": "SK",
    "Slovensko": "SK",
    "Hungary": "HU",
    "Magyarország": "HU",
    "Romania": "RO",
    "România": "RO",
    "Bulgaria": "BG",
    "България": "BG",
    "Croatia": "HR",
    "Hrvatska": "HR",
    "Slovenia": "SI",
    "Slovenija": "SI",
    "Greece": "GR",
    "Ελλάδα": "GR",
    "Portugal": "PT",
    "Denmark": "DK",
    "Danmark": "DK",
    "Sweden": "SE",
    "Sverige": "SE",
    "Finland": "FI",
    "Suomi": "FI",
    "Luxembourg": "LU",
    "Lëtzebuerg": "LU",
    "Malta": "MT",
    "Cyprus": "CY",
    "Κύπρος": "CY",
    "Estonia": "EE",
    "Eesti": "EE",
    "Latvia": "LV",
    "Latvija": "LV",
    "Lithuania": "LT",
    "Lietuva": "LT",
    "Ireland": "IE",
    "Éire": "IE",
    
    // Non-EU European countries
    "United Kingdom": "GB",
    "UK": "GB",
    "Great Britain": "GB",
    "England": "GB",
    "Scotland": "GB",
    "Wales": "GB",
    "Northern Ireland": "GB",
    "Switzerland": "CH",
    "Schweiz": "CH",
    "Suisse": "CH",
    "Ukraine": "UA",
    "Україна": "UA",
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
    if (country.toLowerCase().includes(normalizedCountry) || 
        normalizedCountry.includes(country.toLowerCase())) {
      return code;
    }
  }
  
  // Default to Germany if no match found
  return "DE";
}

export function detectLanguage(): Language {
  if (typeof navigator === "undefined") return Language.en;
  const langCode = navigator.language.slice(0, 2);
  const mapped = (Language as Record<string, Language>)[langCode];
  return mapped ?? Language.en;
}

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "it", label: "Italian" },
  { code: "es", label: "Spanish" },
  { code: "pt", label: "Portuguese" },
];

//  * Maps browser/system language to your supported language codes.
//  * Defaults to English if not supported.
//  */
export function getInitialLanguage(): "en" | "es" | "fr" | "de" | "it" | "pt" {
  if (typeof navigator === "undefined") return "en";
  const langCode = navigator.language.slice(0, 2).toLowerCase();
  const supportedLanguages = ["en", "es", "fr", "de", "it", "pt"];
  if (supportedLanguages.includes(langCode)) {
    return langCode as "en" | "es" | "fr" | "de" | "it" | "pt";
  }
  return "en";
}

// Currency formatting

export function getLocaleAndCurrency() {
  if (typeof window !== "undefined") {
    // Try to get user's browser settings
    const locale = navigator.language || "en-US";
    // For demo, always EUR, but you could map locale to currency if needed
    const currency = "EUR";
    return { locale, currency };
  }
  return { locale: "en-US", currency: "EUR" };
}
