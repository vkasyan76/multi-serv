"use client";

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ChevronDownIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react";

import { useTRPC } from "@/trpc/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PriceFilter } from "@/modules/tenants/ui/components/price-filter";
import { DistanceFilter } from "@/modules/tenants/ui/components/distance-filter";
import { HomeCategoryPickerDialog } from "./home-category-picker-dialog";
import type { HomeMarketplaceFilters } from "../home-marketplace-filters";
import { HomeDistanceSelect } from "./home-distance-select";
import { HomePriceInput } from "./home-price-input";
import { HomeWorkTypeSelect } from "./home-work-type-select";

type Props = {
  isSignedIn: boolean;
  hasViewerCoords: boolean;
  filters: HomeMarketplaceFilters;
  onFiltersChange: Dispatch<SetStateAction<HomeMarketplaceFilters>>;
  onViewResultsAction?: () => void;
};

export function HomeMarketplaceSearchBlock({
  isSignedIn,
  hasViewerCoords,
  filters,
  onFiltersChange,
  onViewResultsAction,
}: Props) {
  const trpc = useTRPC();
  const tCommon = useTranslations("common");
  const tMarketplace = useTranslations("marketplace");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);

  const categoriesQ = useQuery({
    ...trpc.categories.getAvailableForHomepage.queryOptions(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const categoryOptions = useMemo(
    () =>
      (categoriesQ.data ?? []).map((category) => ({
        label: category.name,
        value: category.slug,
        workType: category.workType ?? null,
      })),
    [categoriesQ.data]
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
      maxDistance: enabled ? (filters.maxDistance ?? 50) : null,
    });
  };

  useEffect(() => {
    if (!filters.category || categoriesQ.isLoading) return;

    const selectedStillValid = filteredCategoryOptions.some(
      (option) => option.value === filters.category
    );

    if (!selectedStillValid) {
      // workType owns category availability in this compact homepage flow, so
      // clear stale category picks when the chosen work type excludes them.
      updateFilters({ category: "" });
    }
  }, [
    categoriesQ.isLoading,
    filteredCategoryOptions,
    filters.category,
    onFiltersChange,
  ]);

  const selectedCategoryLabel =
    categoriesQ.isLoading
      ? tMarketplace("home_search.category_loading")
      : filteredCategoryOptions.find((option) => option.value === filters.category)
          ?.label ??
        tMarketplace("filters.all_categories");

  return (
    <>
      <section className="mt-6 rounded-[28px] border border-black/10 bg-white p-3 shadow-[0_18px_40px_rgba(0,0,0,0.06)] md:p-4">
        <div className="space-y-3">
          <div className="hidden rounded-[24px] border border-black/10 bg-[#F4F4F0] p-2 lg:block">
            {/* Desktop homepage controls stay compact and local-state driven so
            the orbit preview gets more space without changing listing behavior.
            Keep this shell tight and avoid a second action row underneath. */}
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_240px_170px_210px_190px] lg:grid-cols-[minmax(0,1fr)_220px_160px_200px_180px]">
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
                className="flex h-12 items-center justify-between gap-3 rounded-full border border-black/10 bg-white px-4 text-left text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => setIsCategoryPickerOpen(true)}
                disabled={categoriesQ.isLoading}
              >
                <span className="truncate">{selectedCategoryLabel}</span>
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

            <button
              type="button"
              className="flex h-14 items-center justify-between gap-3 border-b border-black/10 px-4 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setIsCategoryPickerOpen(true)}
              disabled={categoriesQ.isLoading}
            >
              <span className="truncate font-medium">{selectedCategoryLabel}</span>
              <ChevronDownIcon className="size-4 text-muted-foreground" />
            </button>

            <Button
              type="button"
              variant="ghost"
              className="h-14 rounded-none px-5 lg:hidden"
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

              <div className="space-y-3">
                <p className="text-sm font-medium">
                  {tMarketplace("filters.type_of_work")}
                </p>
                <HomeWorkTypeSelect
                  value={filters.workType}
                  onChange={(workType) => updateFilters({ workType })}
                  className="min-w-0"
                />
              </div>

              {onViewResultsAction && (
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-full"
                    onClick={onViewResultsAction}
                  >
                    {tCommon("buttons.view_all")}
                  </Button>
                </div>
              )}
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
        loading={categoriesQ.isLoading}
      />
    </>
  );
}
