export type HomeMarketplaceFilters = {
  search: string;
  category: string;
  services: string[];
  maxPrice: string;
  distanceFilterEnabled: boolean;
  maxDistance: number | null;
};

export const DEFAULT_HOME_MARKETPLACE_FILTERS: HomeMarketplaceFilters = {
  search: "",
  category: "",
  services: [],
  maxPrice: "",
  distanceFilterEnabled: false,
  maxDistance: null,
};

type Viewer = { lat: number; lng: number; city?: string | null } | undefined;

export function buildHomeMarketplaceQueryInput({
  filters,
  viewer,
  isSignedIn,
  limit = 24,
}: {
  filters: HomeMarketplaceFilters;
  viewer: Viewer;
  isSignedIn: boolean;
  limit?: number;
}) {
  return {
    sort: "distance" as const,
    search: filters.search.trim(),
    maxPrice: filters.maxPrice.trim(),
    services: filters.services,
    category: filters.category || null,
    categories: null,
    subcategory: null,
    distanceFilterEnabled: isSignedIn && filters.distanceFilterEnabled,
    maxDistance:
      isSignedIn && filters.distanceFilterEnabled ? filters.maxDistance : null,
    userLat: viewer?.lat ?? null,
    userLng: viewer?.lng ?? null,
    limit,
  };
}
