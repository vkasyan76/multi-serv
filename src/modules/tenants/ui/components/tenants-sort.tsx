"use client";

import { cn } from "@/lib/utils";
import { useTenantFilters } from "../../hooks/use-tenant-filters";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown } from "lucide-react";

export const TenantSort = () => {
  const [filters, setFilters] = useTenantFilters();
  const sort = filters.sort ?? "distance";

  // Helper function to toggle price sorting
  const togglePriceSort = () => {
    if (sort === "price_low_to_high") {
      setFilters((prev) => ({ ...prev, sort: "price_high_to_low" }));
    } else {
      setFilters((prev) => ({ ...prev, sort: "price_low_to_high" }));
    }
  };

  // Helper function to toggle market tenure sorting
  const toggleTenureSort = () => {
    if (sort === "tenure_newest") {
      setFilters((prev) => ({ ...prev, sort: "tenure_oldest" }));
    } else {
      setFilters((prev) => ({ ...prev, sort: "tenure_newest" }));
    }
  };

  // Check if any price sort is active
  const isPriceSortActive =
    sort === "price_low_to_high" || sort === "price_high_to_low";

  // Check if any tenure sort is active
  const isTenureSortActive =
    sort === "tenure_newest" || sort === "tenure_oldest";

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        className={cn(
          "rounded-full bg-white hover:bg-white",
          sort !== "distance" &&
            "bg-transparent border-transparent hover:border-border hover:bg-transparent"
        )}
        variant="secondary"
        onClick={() => setFilters((prev) => ({ ...prev, sort: "distance" }))}
      >
        Distance
      </Button>
      <Button
        size="sm"
        className={cn(
          "rounded-full bg-white hover:bg-white",
          !isPriceSortActive &&
            "bg-transparent border-transparent hover:border-border hover:bg-transparent"
        )}
        variant="secondary"
        onClick={togglePriceSort}
      >
        Price{" "}
        {sort === "price_low_to_high" ? (
          <ChevronUp className="ml-1 h-4 w-4" />
        ) : (
          <ChevronDown className="ml-1 h-4 w-4" />
        )}
      </Button>

      <Button
        size="sm"
        className={cn(
          "rounded-full bg-white hover:bg-white",
          !isTenureSortActive &&
            "bg-transparent border-transparent hover:border-border hover:bg-transparent"
        )}
        variant="secondary"
        onClick={toggleTenureSort}
      >
        Market Tenure{" "}
        {sort === "tenure_newest" ? (
          <ChevronUp className="ml-1 h-4 w-4" />
        ) : (
          <ChevronDown className="ml-1 h-4 w-4" />
        )}
      </Button>
    </div>
  );
};
