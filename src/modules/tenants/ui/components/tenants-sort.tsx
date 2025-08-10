"use client";

import { cn } from "@/lib/utils";
import { useTenantFilters } from "../../hooks/use-tenant-filters";
import { Button } from "@/components/ui/button";

export const TenantSort = () => {
  const [filters, setFilters] = useTenantFilters();
  const sort = filters.sort ?? "curated"; // falling back to "curated" when filters.sort is undefined or null.

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        className={cn(
          "rounded-full bg-white hover:bg-white",
          sort !== "curated" &&
            "bg-transparent border-transparent hover:border-border hover:bg-transparent"
        )}
        variant="secondary"
        onClick={() => setFilters((prev) => ({ ...prev, sort: "curated" }))}
      >
        Curated
      </Button>
      <Button
        size="sm"
        className={cn(
          "rounded-full bg-white hover:bg-white",
          sort !== "trending" &&
            "bg-transparent border-transparent hover:border-border hover:bg-transparent"
        )}
        variant="secondary"
        onClick={() => setFilters((prev) => ({ ...prev, sort: "trending" }))}
      >
        Trending
      </Button>
      <Button
        size="sm"
        className={cn(
          "rounded-full bg-white hover:bg-white",
          sort !== "hot_and_new" &&
            "bg-transparent border-transparent hover:border-border hover:bg-transparent"
        )}
        variant="secondary"
        onClick={() => setFilters((prev) => ({ ...prev, sort: "hot_and_new" }))}
      >
        Hot & New
      </Button>
    </div>
  );
};
