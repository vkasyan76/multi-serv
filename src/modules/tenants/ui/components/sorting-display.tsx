"use client";

import { useTenantFilters } from "../../hooks/use-tenant-filters";

interface SortingDisplayProps {
  isSignedIn: boolean;
}

export const SortingDisplay = ({ isSignedIn }: SortingDisplayProps) => {
  const [filters] = useTenantFilters();
  const sort = filters.sort ?? "distance";

  const getSortingText = () => {
    // If anonymous user has distance selected, show the fallback sorting
    if (!isSignedIn && sort === "distance") {
      return "Sorted by Price (low to high)";
    }

    switch (sort) {
      case "price_low_to_high":
        return "Sorted by Price (low to high)";
      case "price_high_to_low":
        return "Sorted by Price (high to low)";
      case "tenure_newest":
        return "Sorted by Market Tenure (newest first)";
      case "tenure_oldest":
        return "Sorted by Market Tenure (oldest first)";
      case "distance":
      default:
        return "Sorted by Distance (nearest first)";
    }
  };

  return (
    <p className="text-2xl font-medium">
      {getSortingText()}
    </p>
  );
};
