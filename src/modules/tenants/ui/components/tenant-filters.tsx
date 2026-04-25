"use client";

import { cn } from "@/lib/utils";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

import { PriceFilter } from "./price-filter";
import { useTenantFilters } from "../../hooks/use-tenant-filters";
import { ServicesFilter } from "./services-filter";
import { DistanceFilter } from "./distance-filter";
import { CategoryFilter } from "./category-filter";
import { DEFAULT_DISTANCE_OPTION } from "@/modules/tenants/distance-options";

interface TenantFilterProps {
  title: string;
  className?: string;
  children: React.ReactNode;
}

const TenantFilter = ({ title, className, children }: TenantFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const Icon = isOpen ? ChevronDownIcon : ChevronRightIcon;

  return (
    <div className={cn("p-4 border-b flex flex-col gap-2", className)}>
      <div
        onClick={() => setIsOpen((current) => !current)}
        className="flex items-center justify-between cursor-pointer"
      >
        <p className="font-medium">{title}</p>
        <Icon className="size-5" />
      </div>
      {isOpen && children}
    </div>
  );
};

interface TenantFiltersProps {
  isSignedIn: boolean;
  showCategory?: boolean;
}

export const TenantFilters = ({
  isSignedIn,
  showCategory = false,
}: TenantFiltersProps) => {
  const tMarketplace = useTranslations("marketplace");
  const [filters, setFilters] = useTenantFilters();
  const onChange = (key: keyof typeof filters, value: unknown) => {
    setFilters({ ...filters, [key]: value });
  };

  // Read categories from React Query cache (prefetched in (home)/layout);
  // if not prefetched, this will fetch once.
  const trpc = useTRPC();
  const categoriesQ = useQuery({
    ...trpc.categories.getMany.queryOptions(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const categoryOptions = (categoriesQ.data ?? []).map((c) => ({
    slug: c.slug,
    name: c.name,
  }));

  // Helper functions for distance filter state management
  const handleDistanceChange = (value: number | null) => {
    setFilters((prev) => ({
      ...prev,
      distanceFilterEnabled: value != null && value > 0,
      maxDistance: value,
    }));
  };

  const handleDistanceToggle = (enabled: boolean) => {
    setFilters((prev) => ({
      ...prev,
      distanceFilterEnabled: enabled,
      maxDistance: enabled ? (prev.maxDistance ?? DEFAULT_DISTANCE_OPTION) : null,
    }));
  };

  // Checks if string values are not empty ("") and if non-string values are not null.
  // This logic ensures that the "Clear" button is only displayed when at least one filter is active.
  // It treats zero as boolean true or false
  const hasAnyFilters = Object.entries(filters).some(([key, value]) => {
    // Skip the sort field since it always has a default value: Exclude sort from the filter check
    if (key === "sort") return false;
    if (key === "maxDistance") {
      // Only count maxDistance as a filter if distanceFilterEnabled is true
      return (
        filters.distanceFilterEnabled && value !== null && value !== undefined
      );
    }
    if (key === "distanceFilterEnabled") return false;
    if (typeof value === "string") {
      return value !== "";
    }
    if (Array.isArray(value)) {
      return value.length > 0; // Checks if services or any array filter is not empty
    }
    return value != null;
  });

  const handleClear = () => {
    setFilters({
      maxPrice: "",
      services: [],
      maxDistance: 0,
      distanceFilterEnabled: false,
      category: "",
      subcategory: "",
      categories: [],
    });
  };

  return (
    <div className="border rounded-md bg-white">
      <div className="p-4 border-b flex items-center justify-between">
        <p className="font-medium">{tMarketplace("filters.title")}</p>
        {hasAnyFilters && (
          <button className="underline" onClick={handleClear} type="button">
            {tMarketplace("filters.clear")}
          </button>
        )}
      </div>
      {/* Step 2: translate shared filter chrome only; keep filter state/URL logic untouched. */}
      <TenantFilter title={tMarketplace("filters.max_hourly_rate")}>
        <PriceFilter
          maxPrice={filters.maxPrice}
          onMaxPriceChange={(value) => onChange("maxPrice", value)}
        />
      </TenantFilter>

      <TenantFilter title={tMarketplace("filters.location_distance")}>
        <DistanceFilter
          maxDistance={filters.maxDistance}
          isEnabled={filters.distanceFilterEnabled}
          onMaxDistanceChangeAction={handleDistanceChange}
          onToggleChangeAction={handleDistanceToggle}
          hasOnlineServices={filters.services?.includes("on-line") || false}
          isSignedIn={isSignedIn}
        />
      </TenantFilter>

      <TenantFilter title={tMarketplace("filters.service_delivery")}>
        <ServicesFilter
          value={filters.services}
          onChange={(value) => onChange("services", value)}
        />
      </TenantFilter>
      {showCategory && (
        <TenantFilter
          title={tMarketplace("filters.category")}
          className="border-b-0"
        >
          <CategoryFilter
            options={categoryOptions}
            disabled={categoriesQ.isLoading || categoriesQ.isError}
          />
        </TenantFilter>
      )}
    </div>
  );
};
