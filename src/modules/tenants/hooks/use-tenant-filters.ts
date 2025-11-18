import {
  parseAsString,
  parseAsArrayOf,
  parseAsInteger,
  parseAsBoolean,
  useQueryStates,
  parseAsStringLiteral,
} from "nuqs";
import { SORT_VALUES } from "@/constants";
// import { createLoader, parseAsString } from "nuqs/server";

// export const sortValues = ["curated", "trending", "hot_and_new"] as const;
// export const sortValues = [
//   "price_low_to_high",
//   "price_high_to_low",
//   "distance",
//   "tenure_newest",
//   "tenure_oldest",
// ] as const;

export const params = {
  sort: parseAsStringLiteral(SORT_VALUES).withDefault("distance"),
  maxPrice: parseAsString.withDefault(""),
  services: parseAsArrayOf(parseAsString)
    .withOptions({ clearOnDefault: true })
    .withDefault([]),
  maxDistance: parseAsInteger
    .withOptions({ clearOnDefault: true })
    .withDefault(0),
  distanceFilterEnabled: parseAsBoolean
    .withDefault(false)
    .withOptions({ clearOnDefault: false }),
  category: parseAsString.withOptions({ clearOnDefault: true }).withDefault(""),
  subcategory: parseAsString
    .withOptions({ clearOnDefault: true })
    .withDefault(""),
};

// passing to the client tenant-filters.tsx:

export const useTenantFilters = () => {
  return useQueryStates(params);
};

// import { useQueryStates } from "nuqs";
// import { createLoader, parseAsString } from "nuqs/server";

// export const params = {
//   minPrice: parseAsString.withOptions({ clearOnDefault: true }),
//   maxPrice: parseAsString.withOptions({ clearOnDefault: true }),
// };
// allows you to read URL parameters on the server side during SSR/SSG: passing to the category page: we separate it in the search-params
// export const useProductFilters = () => {
//   return useQueryStates(params);
// };

// export const loadProductFilters = createLoader(params);
