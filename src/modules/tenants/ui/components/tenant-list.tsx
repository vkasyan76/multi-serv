"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTenantFilters } from "../../hooks/use-tenant-filters";
import { TenantCard } from "./tenant-card";
import { ListSkeleton } from "./skeletons/list-skeleton";
import { DEFAULT_LIMIT } from "@/constants";
import type { TenantWithRelations } from "../../types";

interface Props {
  category?: string;
  subcategory?: string;
}

export const TenantList = ({ category, subcategory }: Props) => {
  const trpc = useTRPC();
  const [filters] = useTenantFilters();

  // Use regular useSuspenseQuery for user profile
  const { data: userProfile } = useSuspenseQuery(
    trpc.auth.getUserProfile.queryOptions()
  );

  // Use regular query - React Query handles caching automatically
  const { data, isLoading } = useSuspenseQuery(
    trpc.tenants.getMany.queryOptions({
      category: category || null,
      subcategory: subcategory || null,
      ...filters,
      userLat: userProfile?.coordinates?.lat ?? null,
      userLng: userProfile?.coordinates?.lng ?? null,
      limit: DEFAULT_LIMIT,
    })
  );

  // Show skeleton while loading
  if (isLoading) {
    return <ListSkeleton count={6} />;
  }

  // Show empty state if no tenants
  if (!data?.docs || data.docs.length === 0) {
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
    <div className="space-y-6">
      {/* Tenant Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {data.docs.map((tenant: TenantWithRelations) => (
          <TenantCard
            key={tenant.id}
            tenant={tenant}
            reviewRating={3} // Placeholder - will be replaced with backend data
            reviewCount={5} // Placeholder - will be replaced with backend data
          />
        ))}
      </div>

      {/* Results Summary */}
      <div className="text-center text-sm text-gray-500">
        Showing {data.docs.length} of {data.totalDocs} tenants
      </div>
    </div>
  );
};

// Export the skeleton for external use
export const TenantListSkeleton = () => {
  return <ListSkeleton count={6} />;
};
