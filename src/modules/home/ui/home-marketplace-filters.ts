import { normalizeDistanceOption } from "@/modules/tenants/distance-options";

export type HomeMarketplaceFilters = {
  search: string;
  category: string;
  maxPrice: string;
  distanceFilterEnabled: boolean;
  maxDistance: number | null;
  workType: "manual" | "consulting" | "digital" | "";
};

export const DEFAULT_HOME_MARKETPLACE_FILTERS: HomeMarketplaceFilters = {
  search: "",
  category: "",
  maxPrice: "",
  distanceFilterEnabled: false,
  maxDistance: null,
  workType: "",
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
  const hasViewerCoords =
    typeof viewer?.lat === "number" && typeof viewer?.lng === "number";
  const canApplyDistanceFilter =
    isSignedIn && hasViewerCoords && filters.distanceFilterEnabled;
  const normalizedDistance = normalizeDistanceOption(filters.maxDistance);

  // Match the tenants.getMany schema bounds here so future callers cannot
  // accidentally build an out-of-range homepage preview query.
  const safeLimit = Math.min(100, Math.max(1, limit));

  return {
    // Keep the current homepage preview ordering behavior. This patch only
    // fixes invalid active distance-filter states when viewer coords are missing.
    sort: "distance" as const,
    search: filters.search.trim(),
    maxPrice: filters.maxPrice.trim(),
    workType: filters.workType || null,
    category: filters.category || null,
    categories: null,
    subcategory: null,
    distanceFilterEnabled: canApplyDistanceFilter,
    // Normalize legacy non-preset values before querying so old URLs cannot
    // show one distance in the UI and apply a different one in the preview.
    maxDistance: canApplyDistanceFilter ? normalizedDistance : null,
    userLat: viewer?.lat ?? null,
    userLng: viewer?.lng ?? null,
    limit: safeLimit,
  };
}
