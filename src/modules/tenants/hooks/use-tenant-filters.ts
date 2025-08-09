import {
  parseAsString,
  parseAsArrayOf,
  useQueryStates,
  parseAsStringLiteral,
} from "nuqs";
// import { createLoader, parseAsString } from "nuqs/server";

const sortValues = ["curated", "trending", "hot_and_new"] as const;

export const params = {
  sort: parseAsStringLiteral(sortValues).withDefault("curated"),
  minPrice: parseAsString.withOptions({ clearOnDefault: true }).withDefault(""),
  maxPrice: parseAsString.withOptions({ clearOnDefault: true }).withDefault(""),
  tags: parseAsArrayOf(parseAsString)
    .withOptions({ clearOnDefault: true })
    .withDefault([]),
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
