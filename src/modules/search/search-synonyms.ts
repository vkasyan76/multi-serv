import type { SearchSynonym } from "@/modules/search/types";

// Keep the MVP synonym list intentionally short and canonical. Runtime search
// must resolve to slugs, not localized labels or seed-script data structures.
export const SEARCH_SYNONYMS: SearchSynonym[] = [
  {
    term: "auto service",
    locale: "en",
    target: { kind: "category", categorySlug: "auto-repair" },
  },
  {
    term: "car repair",
    locale: "en",
    target: { kind: "category", categorySlug: "auto-repair" },
  },
  {
    term: "plumber",
    locale: "en",
    target: { kind: "category", categorySlug: "plumbing" },
  },
  {
    term: "moving",
    locale: "en",
    target: { kind: "category", categorySlug: "relocation" },
  },
  {
    term: "cleaning",
    locale: "en",
    target: { kind: "category", categorySlug: "cleaning" },
  },
  {
    term: "umzug",
    locale: "de",
    target: { kind: "category", categorySlug: "relocation" },
  },
  {
    term: "sanitar",
    locale: "de",
    target: { kind: "category", categorySlug: "plumbing" },
  },
  {
    term: "sanitaer",
    locale: "de",
    target: { kind: "category", categorySlug: "plumbing" },
  },
];
