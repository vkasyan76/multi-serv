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
export function detectLanguage(): Language {
  if (typeof navigator === "undefined") return Language.en;
  const langCode = navigator.language.slice(0, 2);
  const mapped = (Language as Record<string, Language>)[langCode];
  return mapped ?? Language.en;
}

export const SUPPORTED_LANGUAGES = [
  { code: Language.en, label: "English" },
  { code: Language.de, label: "German" },
  { code: Language.fr, label: "French" },
  { code: Language.it, label: "Italian" },
  { code: Language.es, label: "Spanish" },
];

//  * Maps browser/system language to your supported language codes.
//  * Defaults to English if not supported.
//  */
export function getInitialLanguage(): Language {
  if (typeof navigator === "undefined") return Language.en;
  const langCode = navigator.language.slice(0, 2).toLowerCase();
  const supported = SUPPORTED_LANGUAGES.map((l) => l.code);
  if (supported.includes(langCode as Language)) {
    return langCode as Language;
  }
  return Language.en;
}
