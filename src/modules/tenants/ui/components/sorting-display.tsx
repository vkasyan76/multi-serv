"use client";

import { useTenantFilters } from "../../hooks/use-tenant-filters";
import { useTranslations } from "next-intl";

interface SortingDisplayProps {
  isSignedIn: boolean;
}

export const SortingDisplay = ({ isSignedIn }: SortingDisplayProps) => {
  const tMarketplace = useTranslations("marketplace");
  const [filters] = useTenantFilters();
  const sort = filters.sort ?? "distance";

  const getSortingText = () => {
    // If anonymous user has distance selected, show the fallback sorting
    if (!isSignedIn && sort === "distance") {
      // Step 7 keeps the existing anonymous-distance fallback and only
      // translates the visible status text.
      return tMarketplace("sort.sorted_by_price_low_to_high");
    }

    switch (sort) {
      case "price_low_to_high":
        return tMarketplace("sort.sorted_by_price_low_to_high");
      case "price_high_to_low":
        return tMarketplace("sort.sorted_by_price_high_to_low");
      case "tenure_newest":
        return tMarketplace("sort.sorted_by_tenure_newest");
      case "tenure_oldest":
        return tMarketplace("sort.sorted_by_tenure_oldest");
      case "distance":
      default:
        return tMarketplace("sort.sorted_by_distance");
    }
  };

  return (
    <p className="text-2xl font-medium">
      {getSortingText()}
    </p>
  );
};
