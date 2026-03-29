import "server-only";

import { TenantListView } from "@/modules/tenants/ui/views/tenant-list-view";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient, trpc } from "@/trpc/server";
import { normalizeToSupported } from "@/lib/i18n/app-lang";
import { DEFAULT_LIMIT } from "@/constants";

interface Props {
  // Next.js asynchronously provides params
  params: Promise<{ lang: string; category: string; subcategory: string }>;
}

const Page = async ({ params }: Props) => {
  const { lang, category, subcategory } = await params;
  const appLang = normalizeToSupported(lang);
  const normalizedCategory = category && category !== "all" ? category : null;

  const queryClient = getQueryClient();

  // Note: getUserProfile is fetched conditionally in TenantList component
  // No need to prefetch here for anonymous users

  // Prefetch tenants with infinite query options
  const base = trpc.tenants.getMany.infiniteQueryOptions(
    {
      // Mirror the anonymous TenantList defaults exactly so SSR hydration can
      // reuse the same localized cache entry on the first client render.
      // Treat "all" like the client does so SSR and hydration share one key.
      categories: normalizedCategory ? [normalizedCategory] : null,
      subcategory: subcategory ?? null,
      sort: "distance",
      search: "",
      maxPrice: "",
      services: [],
      maxDistance: null,
      distanceFilterEnabled: false,
      userLat: null,
      userLng: null,
      limit: DEFAULT_LIMIT,
    },
    {
      getNextPageParam: (lastPage) => {
        return lastPage.hasNextPage ? lastPage.nextPage : undefined;
      },
    }
  );
  // Await server prefetch so dehydrate(...) includes the localized tenant query
  // data instead of racing ahead with an empty hydration snapshot.
  const queryKey = [
    base.queryKey[0],
    { ...(base.queryKey[1] ?? {}), locale: appLang },
  ] as unknown as typeof base.queryKey;
  await queryClient.prefetchInfiniteQuery({
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
