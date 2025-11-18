"use client";

import { cn } from "@/lib/utils";
import { useTenantFilters } from "../../hooks/use-tenant-filters";

export type CategoryOption = {
  slug: string;
  name: string;
  count?: number;
};

export function CategoryFilter({
  options,
  className,
  disabled,
}: {
  options: CategoryOption[];
  className?: string;
  disabled?: boolean;
}) {
  const [filters, setFilters] = useTenantFilters();
  const current = filters.category ?? "";

  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm text-muted-foreground">Category</label>
      <select
        value={current}
        onChange={(e) =>
          setFilters((prev) => ({
            ...prev,
            category: e.target.value || "",
            subcategory: "", // reset when category changes
          }))
        }
        disabled={disabled}
        className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
        aria-label="Filter by category"
      >
        <option value="">All categories</option>
        {options.map((opt) => (
          <option key={opt.slug} value={opt.slug}>
            {opt.name}
            {typeof opt.count === "number" ? ` (${opt.count})` : ""}
          </option>
        ))}
      </select>
      {options.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No categories available.
        </p>
      )}
    </div>
  );
}
