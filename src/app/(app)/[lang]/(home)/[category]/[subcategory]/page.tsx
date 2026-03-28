import { TenantListView } from "@/modules/tenants/ui/views/tenant-list-view";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient, trpc } from "@/trpc/server";
import { normalizeToSupported } from "@/lib/i18n/app-lang";

interface Props {
  // Next.js asynchronously provides params
  params: Promise<{ lang: string; category: string; subcategory: string }>;
}

const Page = async ({ params }: Props) => {
  const { lang, category, subcategory } = await params;
  const appLang = normalizeToSupported(lang);

  const queryClient = getQueryClient();
  
  // Note: getUserProfile is fetched conditionally in TenantList component
  // No need to prefetch here for anonymous users
  
  // Prefetch tenants with infinite query options
  const base = trpc.tenants.getMany.infiniteQueryOptions(
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
  );
  // Match the client-side locale-scoped key so localized tenant docs hydrate correctly.
  const queryKey = [
    base.queryKey[0],
    { ...(base.queryKey[1] ?? {}), locale: appLang },
  ] as unknown as typeof base.queryKey;
  void queryClient.prefetchInfiniteQuery({
    ...base,
    queryKey,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TenantListView category={category} subcategory={subcategory} />
    </HydrationBoundary>
  );
};

export default Page;
