"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ChevronDownIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react";

import { useTRPC } from "@/trpc/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PriceFilter } from "@/modules/tenants/ui/components/price-filter";
import { DistanceFilter } from "@/modules/tenants/ui/components/distance-filter";
import { ServicesFilter } from "@/modules/tenants/ui/components/services-filter";
import { HomeCategoryPickerDialog } from "./home-category-picker-dialog";
import type { HomeMarketplaceFilters } from "../home-marketplace-filters";

type Props = {
  isSignedIn: boolean;
  filters: HomeMarketplaceFilters;
  onFiltersChange: Dispatch<SetStateAction<HomeMarketplaceFilters>>;
  onViewResultsAction?: () => void;
};

export function HomeMarketplaceSearchBlock({
  isSignedIn,
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

  const selectedCategoryLabel =
    categoriesQ.isLoading
      ? tMarketplace("home_search.category_loading")
      : categoryOptions.find((option) => option.value === filters.category)
          ?.label ??
        tMarketplace("filters.all_categories");

  return (
    <>
      <section className="mt-6 rounded-[28px] border border-black/10 bg-white p-4 shadow-[0_18px_40px_rgba(0,0,0,0.06)] md:p-6">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[24px] border border-black/10 bg-white lg:grid lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="relative border-b border-black/10 lg:border-r lg:border-b-0">
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
              className="flex h-14 items-center justify-between gap-3 border-b border-black/10 px-4 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60 lg:border-b-0"
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

          <div className="hidden gap-4 rounded-[24px] border border-black/10 bg-[#F4F4F0] p-4 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div className="space-y-3">
              <p className="text-sm font-medium">
                {tMarketplace("filters.service_delivery")}
              </p>
              <ServicesFilter
                value={filters.services}
                onChange={(services) => updateFilters({ services })}
              />
            </div>

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
                hasOnlineServices={filters.services.includes("on-line")}
                isSignedIn={isSignedIn}
              />
            </div>

            {onViewResultsAction && (
              <div className="flex items-end justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={onViewResultsAction}
                >
                  {tCommon("buttons.view_all")}
                </Button>
              </div>
            )}
          </div>

          {showAdvanced && (
            <div className="grid gap-4 rounded-[24px] border border-black/10 bg-[#F4F4F0] p-4 lg:hidden">
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  {tMarketplace("filters.service_delivery")}
                </p>
                <ServicesFilter
                  value={filters.services}
                  onChange={(services) => updateFilters({ services })}
                />
              </div>

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
                  hasOnlineServices={filters.services.includes("on-line")}
                  isSignedIn={isSignedIn}
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
        options={categoryOptions}
        loading={categoriesQ.isLoading}
      />
    </>
  );
}
