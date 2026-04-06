import { SERVICES_OPTIONS } from "@/constants";
import { withLocalePrefix } from "@/i18n/routing";
import type { AppLang } from "@/lib/i18n/app-lang";
import type { HomeMarketplaceFilters } from "./home-marketplace-filters";

type BuildHomeMarketplaceHrefInput = {
  lang: AppLang;
  filters: HomeMarketplaceFilters;
  isSignedIn: boolean;
};

const VALID_SERVICES = new Set(SERVICES_OPTIONS.map((option) => option.value));

export function buildHomeMarketplaceHref({
  lang,
  filters,
  isSignedIn,
}: BuildHomeMarketplaceHrefInput) {
  const {
    category,
    search,
    services,
    maxPrice,
    distanceFilterEnabled,
    maxDistance,
  } = filters;
  const pathname = category ? `/${category}` : "/all";
  const params = new URLSearchParams();

  const trimmedSearch = search.trim();
  if (trimmedSearch) {
    params.set("search", trimmedSearch);
  }

  const normalizedPrice = maxPrice.trim();
  if (normalizedPrice && Number(normalizedPrice) > 0) {
    params.set("maxPrice", normalizedPrice);
  }

  const canonicalServices = services.filter((service) =>
    VALID_SERVICES.has(service as (typeof SERVICES_OPTIONS)[number]["value"])
  );
  if (canonicalServices.length > 0) {
    // Mirror the existing nuqs array contract used by listing pages.
    params.set("services", canonicalServices.join(","));
  }

  if (
    isSignedIn &&
    distanceFilterEnabled &&
    typeof maxDistance === "number" &&
    maxDistance > 0
  ) {
    params.set("distanceFilterEnabled", "true");
    params.set("maxDistance", String(maxDistance));
  }

  const localizedPath = withLocalePrefix(pathname, lang);
  const query = params.toString();

  return query ? `${localizedPath}?${query}` : localizedPath;
}
