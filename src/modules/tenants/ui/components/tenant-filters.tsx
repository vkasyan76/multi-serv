"use client";

import { cn } from "@/lib/utils";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { PriceFilter } from "./price-filter";
import { useTenantFilters } from "../../hooks/use-tenant-filters";

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
  
  const handleClear = () => {
    setFilters({
      minPrice: null,
      maxPrice: null,
    });
  };
  
  return (
    <div className="border rounded-md bg-white">
      <div className="p-4 border-b flex items-center justify-between">
        <p className="font-medium">Filters</p>
        <button className="underline" onClick={handleClear} type="button">
          Clear
        </button>
      </div>
      <TenantFilter title="Hourly Rate" className="border-b-0">
        {/* <p>Price filter</p> */}
        <PriceFilter
          minPrice={filters.minPrice}
          maxPrice={filters.maxPrice}
          onMinPriceChange={(value) => onChange("minPrice", value)}
          onMaxPriceChange={(value) => onChange("maxPrice", value)}
        />
      </TenantFilter>
    </div>
  );
};
