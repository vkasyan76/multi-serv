import { Language } from "@googlemaps/google-maps-services-js";
import type { UserCoordinates } from "@/modules/tenants/types";

// IP Geolocation helper function using ipapi.co service
// This provides accurate, production-ready IP geolocation with EU country detection
// Free tier available: https://ipapi.co/
export async function getLocationFromIP(ip: string): Promise<UserCoordinates | undefined> {
  try {
    console.log('IP Geolocation - Fetching location for IP:', ip);
    
    // Use ipapi.co for accurate IP geolocation (free tier available)
    const response = await fetch(`https://ipapi.co/${ip}/json/`);
    const data = await response.json();
    
    if (data.error) {
      console.error('IP geolocation error:', data.reason);
      return undefined;
    }
    
    // Check if it's an EU country
    const euCountries = ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'HR', 'SI', 'GR', 'PT', 'DK', 'SE', 'FI', 'LU', 'MT', 'CY', 'EE', 'LV', 'LT', 'IE'];
    
    if (data.country_code && euCountries.includes(data.country_code)) {
      const result = {
        lat: data.latitude,
        lng: data.longitude,
        city: data.city,
        country: data.country_name,
        region: data.region,
        ipDetected: true,
        manuallySet: false
      };
      
      console.log('IP Geolocation - Successfully extracted EU location:', result);
      return result;
    }
    
    console.log('IP Geolocation - IP not from EU country:', data.country_code);
    return undefined;
    
  } catch (error) {
    console.log('IP geolocation failed:', error);
    return undefined;
  }
}

// Helper functions for robust address parsing from Google Places API
export function extractCityFromAddress(address: string): string {
  // Try to extract city from Google Places formatted address
  // Common patterns: "City Name, Region, Country" or "Street, City, Country"
  const parts = address.split(',').map(part => part.trim());
  
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
  
  return '';
}

export function extractRegionFromAddress(address: string): string {
  const parts = address.split(',').map(part => part.trim());
  
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
    if (part && part.length > 0 && !part.includes('Street') && !part.includes('Road')) {
      return part;
    }
  }
  
  return '';
}

// Helper function to extract IP from request headers (handles proxy scenarios)
export function extractIPFromHeaders(headers: Headers): string {
  // Try multiple IP headers in order of preference
  const possibleIPs = [
    headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    headers.get('x-real-ip'),
    headers.get('x-client-ip'),
    headers.get('cf-connecting-ip'), // Cloudflare
    headers.get('x-forwarded'),
    headers.get('forwarded')?.split(',')[0]?.split('=')[1]?.trim(),
  ].filter(Boolean);

  return possibleIPs[0] || '127.0.0.1';
}

// Helper function to check if coordinates are valid
export function hasValidCoordinates(coordinates: unknown): coordinates is UserCoordinates {
  return !!coordinates &&
    typeof (coordinates as UserCoordinates).lat === "number" &&
    typeof (coordinates as UserCoordinates).lng === "number";
}

// Helper function to merge coordinates while preserving existing metadata
export function mergeCoordinates(
  existingCoords: Partial<UserCoordinates> | undefined,
  newCoords: Partial<UserCoordinates>,
  isManuallySet: boolean = false
): UserCoordinates {
  return {
    ...existingCoords, // preserve existing city/country/region/ipDetected where not provided
    lat: newCoords.lat!,
    lng: newCoords.lng!,
    city: newCoords.city,
    country: newCoords.country,
    region: newCoords.region,
    ipDetected: isManuallySet ? false : (existingCoords?.ipDetected ?? true),
    manuallySet: isManuallySet,
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
