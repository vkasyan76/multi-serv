"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTenantFilters } from "../../hooks/use-tenant-filters";
import { TenantCard } from "./tenant-card";
import { ListSkeleton } from "./skeletons/list-skeleton";
import { DEFAULT_LIMIT } from "@/constants";
import type { TenantWithRelations } from "../../types";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { generateTenantUrl } from "@/lib/utils";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  type AppLang,
  normalizeToSupported,
} from "@/modules/profile/location-utils";
import { normalizeDistanceOption } from "@/modules/tenants/distance-options";

interface Props {
  category?: string;
  subcategory?: string;
  isSignedIn: boolean;
}

export const TenantList = ({ category, subcategory, isSignedIn }: Props) => {
  const trpc = useTRPC();
  const tMarketplace = useTranslations("marketplace");
  const [filters] = useTenantFilters();
  const params = useParams<{ lang?: string }>();
  const normalizedMaxDistance = normalizeDistanceOption(filters.maxDistance);
  const canApplyDistanceFilter =
    isSignedIn && filters.distanceFilterEnabled && normalizedMaxDistance !== null;

  // Prefer route params; strip them out of filters so route slugs stay authoritative.
  const { categories: selectedCategories = [], subcategory: filterSubcategory, ...rest } =
    filters;

  const normalizedCategory = category && category !== "all" ? category : null;
  const categories = Array.from(
    new Set([
      ...(normalizedCategory ? [normalizedCategory] : []),
      ...selectedCategories,
    ])
  );

  const { data: userProfile } = useQuery({
    ...trpc.auth.getUserProfile.queryOptions(),
    enabled: isSignedIn,
  });

  const appLang: AppLang = normalizeToSupported(params?.lang);

  const base = trpc.tenants.getMany.infiniteQueryOptions(
    {
      ...rest,
      categories: categories.length ? categories : null,
      subcategory: subcategory ?? (filterSubcategory || null),
      // Normalize old raw-slider URL values only when distance filtering is
      // actually active so stale maxDistance values do not leak into queries.
      distanceFilterEnabled: canApplyDistanceFilter,
      maxDistance: canApplyDistanceFilter ? normalizedMaxDistance : null,
      userLat: userProfile?.coordinates?.lat ?? null,
      userLng: userProfile?.coordinates?.lng ?? null,
      limit: DEFAULT_LIMIT,
    },
    {
      getNextPageParam: (lastPage) => {
        return lastPage.hasNextPage ? lastPage.nextPage : undefined;
      },
    }
  );

  // Keep list pages on a locale-scoped cache entry for localized tenant fields.
  const queryKey = [
    base.queryKey[0],
    { ...(base.queryKey[1] ?? {}), locale: appLang },
  ] as unknown as typeof base.queryKey;

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSuspenseInfiniteQuery({
      ...base,
      queryKey,
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: "always",
      refetchOnReconnect: "always",
      refetchOnWindowFocus: false,
    });

  const allTenants = data.pages.flatMap((page) => page.docs);
  const totalTenants = data.pages[0]?.totalDocs || 0;

  const slugs = allTenants.map((t: TenantWithRelations) => t.slug);

  const tenantIds = allTenants
    .map((t: TenantWithRelations) => t.id)
    .filter((id): id is string => Boolean(id));

  const { data: summaries } = useQuery({
    ...trpc.reviews.summariesForTenants.queryOptions({ slugs }),
    enabled: slugs.length > 0,
  });

  const summaryMap =
    summaries ??
    ({} as Record<string, { avgRating: number; totalReviews: number }>);

  const { data: orderStats } = useQuery({
    ...trpc.orders.statsForTenants.queryOptions({ tenantIds }),
    enabled: tenantIds.length > 0,
  });

  const ordersMap =
    orderStats ?? ({} as Record<string, { ordersCount: number }>);

  if (allTenants.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 text-lg">
          {tMarketplace("list.empty_title")}
        </div>
        <div className="text-gray-400 text-sm mt-2">
          {tMarketplace("list.empty_body")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 justify-start pt-2">
        {allTenants.map((tenant: TenantWithRelations) => {
          const ratingSummary = summaryMap[tenant.slug];
          const orderSummary = ordersMap[tenant.id];

          return (
            <Link
              key={tenant.id}
              href={generateTenantUrl(tenant.slug, params?.lang)}
              className="block hover:scale-[1.02] transition-transform duration-200"
            >
              <TenantCard
                tenant={tenant}
                reviewRating={ratingSummary?.avgRating ?? null}
                reviewCount={ratingSummary?.totalReviews ?? null}
                isSignedIn={isSignedIn}
                variant="list"
                ordersCount={orderSummary?.ordersCount}
                appLang={appLang}
              />
            </Link>
          );
        })}
      </div>

      {hasNextPage && (
        <div className="flex justify-center pt-6">
          <Button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            variant="outline"
            size="lg"
            className="min-w-[140px]"
          >
            {isFetchingNextPage ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{tMarketplace("list.loading_more")}</span>
              </div>
            ) : (
              tMarketplace("list.load_more")
            )}
          </Button>
        </div>
      )}

      {isFetchingNextPage && <ListSkeleton count={DEFAULT_LIMIT} />}

      <div className="text-center text-sm text-gray-500">
        {tMarketplace("list.results_summary", {
          shown: allTenants.length,
          total: totalTenants,
        })}
      </div>
    </div>
  );
};

export const TenantListSkeleton = () => {
  return <ListSkeleton count={6} />;
};
