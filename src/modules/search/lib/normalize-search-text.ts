const SEPARATOR_REGEX = /[\p{P}\p{S}]+/gu;
const WHITESPACE_REGEX = /\s+/g;

// Matching-only normalization for deterministic navbar search.
// Keep this conservative for MVP 1; typo tolerance and fuzzy logic stay out.
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(SEPARATOR_REGEX, " ")
    .replace(WHITESPACE_REGEX, " ")
    .trim();
}
