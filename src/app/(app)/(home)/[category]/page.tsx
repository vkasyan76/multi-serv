import type { SearchParams } from "nuqs/server";

import { TenantListView } from "@/modules/tenants/ui/views/tenant-list-view";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient, trpc } from "@/trpc/server";
import { loadTenantFilters } from "@/modules/tenants/hooks/search-params";

interface Props {
  // Next.js asynchronously provides params
  params: Promise<{ category: string }>;
  searchParams: Promise<SearchParams>;
}

const Page = async ({ params, searchParams }: Props) => {
  const { category } = await params;

  const filters = await loadTenantFilters(searchParams);

  const queryClient = getQueryClient();
  
  // Note: getUserProfile is fetched conditionally in TenantList component
  // No need to prefetch here for anonymous users

  // Prefetch tenants with infinite query options
  void queryClient.prefetchInfiniteQuery(
    trpc.tenants.getMany.infiniteQueryOptions(
      { 
        category, 
        subcategory: null,
        ...filters,
        userLat: null, // Will be filled by client
        userLng: null, // Will be filled by client
        limit: 8, // DEFAULT_LIMIT
      },
      {
        getNextPageParam: (lastPage) => {
          return lastPage.hasNextPage ? lastPage.nextPage : undefined;
        },
      }
    )
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TenantListView category={category} />
    </HydrationBoundary>
  );
};

export default Page;
