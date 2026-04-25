"use client";

import type { HomepageCategoriesOutput } from "@/modules/categories/types";
import { Categories } from "./search-filters/categories";
import { cn } from "@/lib/utils";

type Props = {
  data: HomepageCategoriesOutput;
  className?: string;
};

export function HomeBrowseCategories({ data, className }: Props) {
  return (
    <div className={cn("w-full", className)}>
      <div className="hidden lg:block">
        <Categories data={data} sidebarData={data} />
      </div>
    </div>
  );
}
