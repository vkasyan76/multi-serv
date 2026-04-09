"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/client";
import { Categories } from "./search-filters/categories";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function HomeBrowseCategories({ className }: Props) {
  const trpc = useTRPC();
  const [isHydrated, setIsHydrated] = useState(false);

  const categoriesQ = useQuery({
    ...trpc.categories.getAvailableForHomepage.queryOptions(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return (
    <div className={cn("w-full", className)}>
      <div className="hidden lg:block">
        {isHydrated && categoriesQ.data ? (
          <Categories data={categoriesQ.data} sidebarData={categoriesQ.data} />
        ) : (
          // Keep the homepage browse rail on a deterministic placeholder until
          // the client hydrates; otherwise the server can emit the simple row
          // while the client immediately renders the measured Categories tree.
          <div className="relative w-full">
            <div className="h-11" />
          </div>
        )}
      </div>
    </div>
  );
}
