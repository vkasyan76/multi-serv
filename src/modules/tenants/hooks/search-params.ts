import {
  createLoader,
  parseAsString,
  parseAsArrayOf,
  parseAsInteger,
  parseAsBoolean,
  parseAsStringLiteral,
} from "nuqs/server";
import { SORT_VALUES } from "@/constants";

// export const sortValues = ["curated", "trending", "hot_and_new"] as const;

const params = {
  sort: parseAsStringLiteral(SORT_VALUES).withDefault("distance"),
  maxPrice: parseAsString.withOptions({ clearOnDefault: true }).withDefault(""),
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

export const loadTenantFilters = createLoader(params);
