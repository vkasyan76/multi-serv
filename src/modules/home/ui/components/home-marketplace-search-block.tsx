"use client";

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useTranslations } from "next-intl";
import { ChevronDownIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PriceFilter } from "@/modules/tenants/ui/components/price-filter";
import { DistanceFilter } from "@/modules/tenants/ui/components/distance-filter";
import { DEFAULT_DISTANCE_OPTION } from "@/modules/tenants/distance-options";
import { HomeCategoryPickerDialog } from "./home-category-picker-dialog";
import type { HomepageCategoriesOutput } from "@/modules/categories/types";
import type { HomeMarketplaceFilters } from "../home-marketplace-filters";
import { HOME_FILTER_PILL_CLASSNAME } from "./home-filter-pill";
import { HomeDistanceSelect } from "./home-distance-select";
import { HomePriceInput } from "./home-price-input";
import { HomeWorkTypeSelect } from "./home-work-type-select";

type Props = {
  categories: HomepageCategoriesOutput;
  isSignedIn: boolean;
  hasViewerCoords: boolean;
  filters: HomeMarketplaceFilters;
  onFiltersChange: Dispatch<SetStateAction<HomeMarketplaceFilters>>;
};

export function HomeMarketplaceSearchBlock({
  categories,
  isSignedIn,
  hasViewerCoords,
  filters,
  onFiltersChange,
}: Props) {
  const tMarketplace = useTranslations("marketplace");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        label: category.name,
        value: category.slug,
        workType: category.workType ?? null,
      })),
    [categories]
  );
  const filteredCategoryOptions = useMemo(
    () =>
      filters.workType
        ? categoryOptions.filter(
            (option) => option.workType === filters.workType
          )
        : categoryOptions,
    [categoryOptions, filters.workType]
  );

  const updateFilters = (patch: Partial<HomeMarketplaceFilters>) =>
    onFiltersChange((prev) => ({ ...prev, ...patch }));

  const handleDistanceChange = (value: number | null) => {
    updateFilters({
      distanceFilterEnabled: value != null && value > 0,
      maxDistance: value,
    });
  };

  const handleDistanceToggle = (enabled: boolean) => {
    updateFilters({
      distanceFilterEnabled: enabled,
      maxDistance: enabled ? (filters.maxDistance ?? DEFAULT_DISTANCE_OPTION) : null,
    });
  };

  useEffect(() => {
    if (!filters.category) return;

    const selectedStillValid = filteredCategoryOptions.some(
      (option) => option.value === filters.category
    );

    if (!selectedStillValid) {
      // workType owns category availability in this compact homepage flow, so
      // clear stale category picks when the chosen work type excludes them.
      updateFilters({ category: "" });
    }
  }, [
    filteredCategoryOptions,
    filters.category,
    onFiltersChange,
  ]);

  const selectedCategoryLabel =
    filteredCategoryOptions.find((option) => option.value === filters.category)
      ?.label ?? tMarketplace("filters.all_categories");

  return (
    <>
      <section className="mt-5 rounded-[28px] border border-black/10 bg-white p-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.06)] md:p-3">
        <div className="space-y-2.5">
          <div className="hidden rounded-[22px] border border-black/10 bg-[#F4F4F0] p-1.5 lg:block">
            {/* Desktop homepage controls stay compact and local-state driven so
            the orbit preview gets more space without changing listing behavior.
            Keep the four non-search controls equal-width, but leave enough room
            for longer locale labels so the row stays readable across languages.
            This intentionally rolls back the last over-tight compaction pass:
            equal widths stay, but the columns are widened back to readable sizes. */}
            <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.12fr)_215px_215px_215px_215px] lg:grid-cols-[minmax(0,1fr)_205px_205px_205px_205px]">
              <div className="relative">
                <SearchIcon className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
                <Input
                  type="search"
                  value={filters.search}
                  onChange={(event) =>
                    updateFilters({ search: event.target.value })
                  }
                  placeholder={tMarketplace("home_search.placeholder")}
                  className="h-12 rounded-full border-black/10 bg-white pl-11 shadow-none"
                />
              </div>

              <button
                type="button"
                className={`${HOME_FILTER_PILL_CLASSNAME} disabled:cursor-not-allowed disabled:opacity-60`}
                onClick={() => setIsCategoryPickerOpen(true)}
              >
                {/* Keep the shell compact; only relax the label line-height so
                descenders like g/p/y do not get clipped. */}
                <span className="truncate leading-tight">{selectedCategoryLabel}</span>
                <ChevronDownIcon className="size-4 text-muted-foreground" />
              </button>

              <HomePriceInput
                value={filters.maxPrice}
                onChange={(maxPrice) => updateFilters({ maxPrice })}
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
              />

              <HomeWorkTypeSelect
                value={filters.workType}
                onChange={(workType) => updateFilters({ workType })}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-black/10 bg-white lg:hidden">
            <div className="relative border-b border-black/10">
              <SearchIcon className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
              <Input
                type="search"
                value={filters.search}
                onChange={(event) =>
                  updateFilters({ search: event.target.value })
                }
                placeholder={tMarketplace("home_search.placeholder")}
                className="h-14 rounded-none border-0 pl-11 shadow-none focus-visible:ring-0"
              />
            </div>

            {/* Mobile keeps the two compact taxonomy filters together so we do
            not duplicate work type lower in the expanded filter stack. */}
            <div className="grid grid-cols-2 gap-2 border-b border-black/10 px-4 py-3">
              <button
                type="button"
                className="flex h-11 min-w-0 items-center justify-between gap-2 rounded-full border border-black/10 bg-white px-4 text-left text-sm font-medium shadow-none disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => setIsCategoryPickerOpen(true)}
              >
                <span className="truncate">{selectedCategoryLabel}</span>
                <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
              </button>

              <HomeWorkTypeSelect
                value={filters.workType}
                onChange={(workType) => updateFilters({ workType })}
                className="min-w-0"
                triggerClassName="h-11 min-w-0"
                compactLabel
              />
            </div>

            <Button
              type="button"
              variant="ghost"
              className="h-14 w-full justify-center rounded-none px-5 lg:hidden"
              onClick={() => setShowAdvanced((current) => !current)}
            >
              <SlidersHorizontalIcon className="size-4" />
              <span>{tMarketplace("filters.title")}</span>
            </Button>
          </div>

          {showAdvanced && (
            <div className="grid gap-4 rounded-[24px] border border-black/10 bg-[#F4F4F0] p-4 lg:hidden">
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  {tMarketplace("filters.max_hourly_rate")}
                </p>
                <PriceFilter
                  maxPrice={filters.maxPrice}
                  onMaxPriceChange={(maxPrice) => updateFilters({ maxPrice })}
                />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">
                  {tMarketplace("filters.location_distance")}
                </p>
                <DistanceFilter
                  maxDistance={filters.maxDistance}
                  isEnabled={filters.distanceFilterEnabled}
                  onMaxDistanceChangeAction={handleDistanceChange}
                  onToggleChangeAction={handleDistanceToggle}
                  hasOnlineServices={false}
                  isSignedIn={isSignedIn}
                />
              </div>
            </div>
          )}
        </div>
      </section>

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
