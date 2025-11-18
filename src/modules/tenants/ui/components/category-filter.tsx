"use client";

import { useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { MultiSelect } from "@/components/ui/multi-select-category";
import { useTenantFilters } from "../../hooks/use-tenant-filters";

export type CategoryOption = {
  slug: string;
  name: string;
  count?: number;
};

type Props = {
  options: CategoryOption[];
  className?: string;
  disabled?: boolean;
  /** set true only if you need an inline label; default avoids the duplicate under the titled accordion */
  showLabel?: boolean;
};

export function CategoryFilter({
  options,
  className,
  disabled,
  showLabel = false,
}: Props) {
  const [filters, setFilters] = useTenantFilters();

  // seed multi 'categories' from route 'category' once (so [category] pages prefill the chip) || Seed from route only if it's not "all"
  useEffect(() => {
    if (
      filters.category &&
      filters.category !== "all" &&
      (!filters.categories || filters.categories.length === 0)
    ) {
      setFilters((prev) => ({ ...prev, categories: [filters.category] }));
    }
    // do not add setFilters to deps to avoid loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.category]);

  // display value: prefer multi 'categories', fall back to route 'category'
  const value =
    filters.categories && filters.categories.length > 0
      ? filters.categories
      : filters.category
        ? [filters.category]
        : [];

  const msOptions = useMemo(
    () =>
      options
        .filter((o) => o.slug !== "all")
        .map((o) => ({ label: o.name, value: o.slug })),
    [options]
  );

  const placeholder =
    value.length > 0
      ? (options.find((o) => o.slug === value[0])?.name ?? "Category")
      : "All categories";

  const onChange = (vals: string[]) => {
    setFilters((prev) => ({
      ...prev,
      categories: vals, // real multi-select
      category: "", // avoid dup with the single route param
      subcategory: vals.length ? "" : prev.subcategory, // reset when category scope changes
    }));
  };

  return (
    <div className={cn("space-y-2", className)}>
      {showLabel && (
        <label className="text-sm text-muted-foreground">Category</label>
      )}
      <MultiSelect
        disabled={disabled}
        options={msOptions}
        value={value}
        onValueChange={onChange}
        placeholder={placeholder}
        placeholderClassName={value.length ? "text-foreground font-medium" : ""}
        className="items-start py-2.5"
        // allow many chips now
        maxCount={msOptions.length} // or Number.MAX_SAFE_INTEGER
        // force dropdown to open DOWN and never flip up
        popoverSide="bottom"
        popoverAvoidCollisions={false}
        // forces remount when selection changes externally
        // key={value.join("|")}
      />
    </div>
  );
}
