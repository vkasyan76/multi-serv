import {
  createLoader,
  parseAsString,
  parseAsArrayOf,
  parseAsStringLiteral,
} from "nuqs/server";
import { SORT_VALUES } from "@/constants";

// export const sortValues = ["curated", "trending", "hot_and_new"] as const;

const params = {
  sort: parseAsStringLiteral(SORT_VALUES).withDefault("distance"),
  minPrice: parseAsString.withOptions({ clearOnDefault: true }).withDefault(""),
  maxPrice: parseAsString.withOptions({ clearOnDefault: true }).withDefault(""),
  services: parseAsArrayOf(parseAsString)
    .withOptions({ clearOnDefault: true })
    .withDefault([]),
};

export const loadTenantFilters = createLoader(params);
