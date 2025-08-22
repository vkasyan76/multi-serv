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

  // Use conditional query for user profile - only fetch if authenticated
  const { data: userProfile } = useQuery({
    ...trpc.auth.getUserProfile.queryOptions(),
    enabled: isSignedIn, // Only fetch if user is signed in
  });

  // Use infinite query for tenants with Load More functionality
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSuspenseInfiniteQuery(
      trpc.tenants.getMany.infiniteQueryOptions(
        {
          category: category || null,
          subcategory: subcategory || null,
          ...filters,
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
      )
    );

  // Flatten all pages into a single array
  const allTenants = data.pages.flatMap((page) => page.docs);

  // Get total count from the first page (all pages have the same totalDocs)
  const totalTenants = data.pages[0]?.totalDocs || 0;

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
        {allTenants.map((tenant: TenantWithRelations) => (
          <Link
            key={tenant.id}
            // href={`/tenants/${tenant.slug}`}
            href={generateTenantUrl(tenant.slug)}
            className="block hover:scale-[1.02] transition-transform duration-200"
          >
            <TenantCard
              key={tenant.id}
              tenant={tenant}
              reviewRating={3}
              reviewCount={5}
              isSignedIn={isSignedIn}
              variant="list"
              ordersCount={12} // placeholder; wire real value later
            />
          </Link>
        ))}
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
