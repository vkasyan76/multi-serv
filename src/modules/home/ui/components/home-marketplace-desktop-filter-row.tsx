"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { ChevronDownIcon, SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { HOME_FILTER_PILL_CLASSNAME } from "./home-filter-pill";
import { HomeDistanceSelect } from "./home-distance-select";
import { HomePriceInput } from "./home-price-input";
import { HomeWorkTypeSelect } from "./home-work-type-select";
import { HomeCategoryPickerDialog } from "./home-category-picker-dialog";
import type { HomepageCategoriesOutput } from "@/modules/categories/types";
import type { HomeMarketplaceFilters } from "../home-marketplace-filters";
import {
  buildHomeCategoryOptions,
  filterHomeCategoryOptions,
  keepCategoryForWorkType,
} from "./home-marketplace-filter-helpers";
import { cn } from "@/lib/utils";

type Props = {
  categories: HomepageCategoriesOutput;
  isSignedIn: boolean;
  hasViewerCoords: boolean;
  filters: HomeMarketplaceFilters;
  onFiltersChange: Dispatch<SetStateAction<HomeMarketplaceFilters>>;
  compact?: boolean;
};

export function HomeMarketplaceDesktopFilterRow({
  categories,
  isSignedIn,
  hasViewerCoords,
  filters,
  onFiltersChange,
  compact = false,
}: Props) {
  const tCommon = useTranslations("common");
  const tMarketplace = useTranslations("marketplace");
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);

  const categoryOptions = useMemo(
    () => buildHomeCategoryOptions(categories),
    [categories]
  );
  const filteredCategoryOptions = useMemo(
    () => filterHomeCategoryOptions(categoryOptions, filters.workType),
    [categoryOptions, filters.workType]
  );

  const selectedCategoryLabel =
    filteredCategoryOptions.find((option) => option.value === filters.category)
      ?.label ?? tMarketplace("filters.all_categories");

  const updateFilters = (patch: Partial<HomeMarketplaceFilters>) =>
    onFiltersChange((prev) => ({ ...prev, ...patch }));

  const handleWorkTypeChange = (
    workType: HomeMarketplaceFilters["workType"]
  ) => {
    onFiltersChange((prev) => ({
      ...prev,
      workType,
      category: keepCategoryForWorkType(
        categoryOptions,
        workType,
        prev.category
      )
        ? prev.category
        : "",
    }));
  };

  const pillHeight = compact ? "h-11" : "h-12";
  const searchHeight = compact ? "h-11" : "h-12";

  return (
    <>
      <div
        className={cn(
          "grid items-start lg:grid-cols-[minmax(0,1fr)_205px_205px_205px_205px]",
          compact
            ? "gap-2 xl:grid-cols-[minmax(0,1.08fr)_205px_205px_205px_205px]"
            : "gap-2.5 xl:grid-cols-[minmax(0,1.12fr)_215px_215px_215px_215px]"
        )}
      >
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
          <Input
            type="search"
            value={filters.search}
            onChange={(event) => updateFilters({ search: event.target.value })}
            // Desktop orbit search now mirrors the category-page provider search
            // wording; mobile keeps the broader homepage copy for now.
            placeholder={tCommon("home.search.placeholder")}
            className={cn(
              "rounded-full border-black/10 bg-white pl-11 shadow-none",
              searchHeight
            )}
          />
        </div>

        <button
          type="button"
          className={cn(
            HOME_FILTER_PILL_CLASSNAME,
            pillHeight,
            "disabled:cursor-not-allowed disabled:opacity-60"
          )}
          onClick={() => setIsCategoryPickerOpen(true)}
        >
          <span className="truncate leading-tight">
            {selectedCategoryLabel}
          </span>
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        </button>

        <HomePriceInput
          value={filters.maxPrice}
          onChange={(maxPrice) => updateFilters({ maxPrice })}
          className={pillHeight}
        />

        <HomeDistanceSelect
          isSignedIn={isSignedIn}
          hasViewerCoords={hasViewerCoords}
          distanceFilterEnabled={filters.distanceFilterEnabled}
          maxDistance={filters.maxDistance}
          onChange={({ enabled, maxDistance }) =>
            updateFilters({
              distanceFilterEnabled: enabled,
              maxDistance,
            })
          }
          triggerClassName={pillHeight}
        />

        <HomeWorkTypeSelect
          value={filters.workType}
          onChange={handleWorkTypeChange}
          triggerClassName={pillHeight}
        />
      </div>

      <HomeCategoryPickerDialog
        open={isCategoryPickerOpen}
        onOpenChange={setIsCategoryPickerOpen}
        value={filters.category}
        onValueChange={(category) => updateFilters({ category })}
        options={filteredCategoryOptions}
        loading={false}
      />
    </>
  );
}
