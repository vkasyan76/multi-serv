"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { MultiSelect } from "@/components/ui/multi-select";
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

  // single-select behavior using MultiSelect UI
  const value = filters.category ? [filters.category] : [];

  const msOptions = useMemo(
    () => options.map((o) => ({ label: o.name, value: o.slug })),
    [options]
  );

  const placeholder = filters.category
    ? (options.find((o) => o.slug === filters.category)?.name ?? "Category")
    : "All categories";

  const onChange = (vals: string[]) => {
    // enforce single selection: last picked wins; empty = “All”
    const next = vals.length ? vals[vals.length - 1] : "";
    setFilters((prev) => ({
      ...prev,
      category: next,
      subcategory: "", // reset when category changes
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
        placeholderClassName={
          filters.category ? "text-foreground font-medium" : ""
        }
        className="items-start py-2.5"
        maxCount={1}
      />
    </div>
  );
}
