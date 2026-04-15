"use client";

import {
  useEffect,
  useMemo,
  useState,
  type Ref,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useTranslations } from "next-intl";
import {
  ChevronDownIcon,
  SlidersHorizontalIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PriceFilter } from "@/modules/tenants/ui/components/price-filter";
import { DistanceFilter } from "@/modules/tenants/ui/components/distance-filter";
import { DEFAULT_DISTANCE_OPTION } from "@/modules/tenants/distance-options";
import { HomeCategoryPickerDialog } from "./home-category-picker-dialog";
import type { HomepageCategoriesOutput } from "@/modules/categories/types";
import type { HomeMarketplaceFilters } from "../home-marketplace-filters";
import { HomeWorkTypeSelect } from "./home-work-type-select";
import { HomeMarketplaceDesktopFilterRow } from "./home-marketplace-desktop-filter-row";
import { MobileGlobalSearch } from "@/modules/search/ui/mobile-global-search";
import {
  buildHomeCategoryOptions,
  filterHomeCategoryOptions,
  keepCategoryForWorkType as keepCategoryForWorkTypeOption,
} from "./home-marketplace-filter-helpers";

type Props = {
  categories: HomepageCategoriesOutput;
  isSignedIn: boolean;
  hasViewerCoords: boolean;
  filters: HomeMarketplaceFilters;
  onFiltersChange: Dispatch<SetStateAction<HomeMarketplaceFilters>>;
  desktopRowRef?: Ref<HTMLDivElement>;
};

export function HomeMarketplaceSearchBlock({
  categories,
  isSignedIn,
  hasViewerCoords,
  filters,
  onFiltersChange,
  desktopRowRef,
}: Props) {
  const tMarketplace = useTranslations("marketplace");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [isMobileSearchActive, setIsMobileSearchActive] = useState(false);

  const categoryOptions = useMemo(
    () => buildHomeCategoryOptions(categories),
    [categories]
  );
  const filteredCategoryOptions = useMemo(
    () => filterHomeCategoryOptions(categoryOptions, filters.workType),
    [categoryOptions, filters.workType]
  );

  const updateFilters = (patch: Partial<HomeMarketplaceFilters>) =>
    onFiltersChange((prev) => ({ ...prev, ...patch }));

  const keepCategoryForWorkType = (
    nextWorkType: HomeMarketplaceFilters["workType"],
    currentCategory: string
  ) =>
    keepCategoryForWorkTypeOption(
      categoryOptions,
      nextWorkType,
      currentCategory
    );

  const handleWorkTypeChange = (
    workType: HomeMarketplaceFilters["workType"]
  ) => {
    // Derive from prev so a workType change cannot reuse an older category from
    // the render closure if state shifts before this update commits.
    onFiltersChange((prev) => ({
      ...prev,
      workType,
      category: keepCategoryForWorkType(workType, prev.category)
        ? prev.category
        : "",
    }));
  };

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
            <div ref={desktopRowRef}>
              {/* Use the large desktop row as the only measurement anchor. The
              compact dock is rendered outside this subtree so toggling it
              cannot push the source block down. */}
              <HomeMarketplaceDesktopFilterRow
                categories={categories}
                isSignedIn={isSignedIn}
                hasViewerCoords={hasViewerCoords}
                filters={filters}
                onFiltersChange={onFiltersChange}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-black/10 bg-white lg:hidden">
            <MobileGlobalSearch onActiveChange={setIsMobileSearchActive} />

            {!isMobileSearchActive ? (
              <>
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
                    onChange={handleWorkTypeChange}
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
              </>
            ) : null}
          </div>

          {showAdvanced && !isMobileSearchActive ? (
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
          ) : null}
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
