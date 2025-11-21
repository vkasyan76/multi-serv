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

interface Props {
  category?: string;
  subcategory?: string;
  isSignedIn: boolean;
}

export const TenantList = ({ category, subcategory, isSignedIn }: Props) => {
  const trpc = useTRPC();
  const [filters] = useTenantFilters();

  // Prefer route params; strip them out of filters to avoid duplicate keys:
  // You were sending duplicate keys for category (and sometimes subcategory) in your query: once from route params and once from filters. Depending on spread order, the filter value ("") could overwrite the route slug, leading to no category filtering. The TenantList merge below removes the duplication and prefers the route param.
  // strip out to avoid duplicates in spread
  const { categories: _cats = [], subcategory: _s, ...rest } = filters;

  // route-based category (except "all")
  const normalizedCategory = category && category !== "all" ? category : null;

  // final OR-list (route param + chips)
  const categories = Array.from(
    new Set([...(normalizedCategory ? [normalizedCategory] : []), ..._cats])
  );

  // Use conditional query for user profile - only fetch if authenticated
  const { data: userProfile } = useQuery({
    ...trpc.auth.getUserProfile.queryOptions(),
    enabled: isSignedIn, // Only fetch if user is signed in
  });

  // Use infinite query for tenants with Load More functionality
  const base = trpc.tenants.getMany.infiniteQueryOptions(
    {
      ...rest,
      // category: normalizedCategory ?? (_c || null),
      // ⬇️ send array instead of single
      categories: categories.length ? categories : null,
      subcategory: subcategory ?? (_s || null),
      ...(isSignedIn
        ? {}
        : { distanceFilterEnabled: false, maxDistance: null }),
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

  // Add cache controls (mirror tenant detail page)
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSuspenseInfiniteQuery({
      ...base,
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: "always",
      refetchOnReconnect: "always",
      refetchOnWindowFocus: false,
    });

  // Flatten all pages into a single array
  const allTenants = data.pages.flatMap((page) => page.docs);

  // Get total count from the first page (all pages have the same totalDocs)
  const totalTenants = data.pages[0]?.totalDocs || 0;

  // Reviews

  // ➊ collect slugs
  const slugs = allTenants.map((t: TenantWithRelations) => t.slug);

  const tenantIds = allTenants
    .map((t: TenantWithRelations) => t.id)
    .filter((id): id is string => Boolean(id));

  // ➋ one query for all ratings on this page
  const { data: summaries } = useQuery({
    ...trpc.reviews.summariesForTenants.queryOptions({ slugs }),
    enabled: slugs.length > 0,
  });

  const summaryMap =
    summaries ??
    ({} as Record<string, { avgRating: number; totalReviews: number }>);

  // ➍ one query for all order counts on this page
  const { data: orderStats } = useQuery({
    ...trpc.orders.statsForTenants.queryOptions({ tenantIds }),
    enabled: tenantIds.length > 0,
  });

  const ordersMap =
    orderStats ?? ({} as Record<string, { ordersCount: number }>);

  // Show empty state if no tenants
  if (allTenants.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 text-lg">
          No tenants found for this category.
        </div>
        <div className="text-gray-400 text-sm mt-2">
          Try adjusting your filters or check back later.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tenant Cards Container */}
      <div className="flex flex-wrap gap-4 justify-start pt-2">
        {allTenants.map((tenant: TenantWithRelations) => {
          const ratingSummary = summaryMap[tenant.slug];
          const orderSummary = ordersMap[tenant.id];
          // As soon as you add { ... } after the arrow, the body becomes a block (not returned automatically), not a single expression.
          return (
            <Link
              key={tenant.id}
              href={generateTenantUrl(tenant.slug)}
              className="block hover:scale-[1.02] transition-transform duration-200"
            >
              <TenantCard
                tenant={tenant}
                reviewRating={ratingSummary?.avgRating ?? null}
                reviewCount={ratingSummary?.totalReviews ?? null}
                isSignedIn={isSignedIn}
                variant="list"
                ordersCount={orderSummary?.ordersCount}
              />
            </Link>
          );
        })}
      </div>

      {/* Load More Button */}
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
                <span>Loading...</span>
              </div>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}

      {/* Loading Skeletons for New Items */}
      {isFetchingNextPage && <ListSkeleton count={DEFAULT_LIMIT} />}

      {/* Results Summary */}
      <div className="text-center text-sm text-gray-500">
        Showing {allTenants.length} providers out of {totalTenants}
      </div>
    </div>
  );
};

// Export the skeleton for external use
export const TenantListSkeleton = () => {
  return <ListSkeleton count={6} />;
};
