"use client";

import { cn } from "@/lib/utils";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { PriceFilter } from "./price-filter";
import { useTenantFilters } from "../../hooks/use-tenant-filters";
import { ServicesFilter } from "./services-filter";
import { DistanceFilter } from "./distance-filter";

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

export const TenantFilters = () => {
  const [filters, setFilters] = useTenantFilters();
  const onChange = (key: keyof typeof filters, value: unknown) => {
    setFilters({ ...filters, [key]: value });
  };

  // Helper functions for distance filter state management
  const handleDistanceChange = (value: number | null) => {
    setFilters(prev => ({
      ...prev,
      distanceFilterEnabled: value != null && value > 0,
      maxDistance: value,
    }));
  };

  const handleDistanceToggle = (enabled: boolean) => {
    setFilters(prev => ({
      ...prev,
      distanceFilterEnabled: enabled,
      maxDistance: enabled ? (prev.maxDistance ?? 50) : null,
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
      return filters.distanceFilterEnabled && value !== null && value !== undefined;
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
      maxPrice: null,
      services: [],
      maxDistance: null,
      distanceFilterEnabled: false,
    });
  };

  return (
    <div className="border rounded-md bg-white">
      <div className="p-4 border-b flex items-center justify-between">
        <p className="font-medium">Filters</p>
        {hasAnyFilters && (
          <button className="underline" onClick={handleClear} type="button">
            Clear
          </button>
        )}
      </div>
      <TenantFilter title="Max Hourly Rate">
        <PriceFilter
          maxPrice={filters.maxPrice}
          onMaxPriceChange={(value) => onChange("maxPrice", value)}
        />
      </TenantFilter>

      <TenantFilter title="Location & Distance">
        <DistanceFilter
          maxDistance={filters.maxDistance}
          isEnabled={filters.distanceFilterEnabled}
          onMaxDistanceChange={handleDistanceChange}
          onToggleChange={handleDistanceToggle}
          hasOnlineServices={filters.services?.includes("on-line") || false}
        />
      </TenantFilter>

      <TenantFilter title="Service Delivery" className="border-b-0">
        <ServicesFilter
          value={filters.services}
          onChange={(value) => onChange("services", value)}
        />
      </TenantFilter>
    </div>
  );
};
