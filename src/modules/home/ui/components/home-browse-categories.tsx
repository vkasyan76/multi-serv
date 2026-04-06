"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/client";
import { Categories } from "./search-filters/categories";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function HomeBrowseCategories({ className }: Props) {
  const trpc = useTRPC();

  const categoriesQ = useQuery({
    ...trpc.categories.getAvailableForHomepage.queryOptions(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className={cn("w-full", className)}>
      <div className="hidden lg:block">
        {categoriesQ.data ? (
          <Categories data={categoriesQ.data} sidebarData={categoriesQ.data} />
        ) : (
          <div className="h-11" />
        )}
      </div>
    </div>
  );
}
