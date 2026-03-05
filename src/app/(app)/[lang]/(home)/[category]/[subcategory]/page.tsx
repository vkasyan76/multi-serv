import { TenantListView } from "@/modules/tenants/ui/views/tenant-list-view";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient, trpc } from "@/trpc/server";

interface Props {
  // Next.js asynchronously provides params
  params: Promise<{ category: string; subcategory: string }>;
}

const Page = async ({ params }: Props) => {
  const { category, subcategory } = await params;

  const queryClient = getQueryClient();
  
  // Note: getUserProfile is fetched conditionally in TenantList component
  // No need to prefetch here for anonymous users
  
  // Prefetch tenants with infinite query options
  void queryClient.prefetchInfiniteQuery(
    trpc.tenants.getMany.infiniteQueryOptions(
      { 
        category: category,      // Parent category
        subcategory: subcategory, // Specific subcategory
        sort: "distance",        // Default sort
        maxPrice: "",
        services: [],
        maxDistance: 0,
        distanceFilterEnabled: false,
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
      <TenantListView category={category} subcategory={subcategory} />
    </HydrationBoundary>
  );
};

export default Page;
