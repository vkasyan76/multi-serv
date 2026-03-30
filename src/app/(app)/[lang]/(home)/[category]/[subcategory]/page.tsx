import "server-only";

import type { SearchParams } from "nuqs/server";
import { TenantListView } from "@/modules/tenants/ui/views/tenant-list-view";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient, trpc } from "@/trpc/server";
import { normalizeToSupported } from "@/lib/i18n/app-lang";
import { DEFAULT_LIMIT } from "@/constants";
import { loadTenantFilters } from "@/modules/tenants/hooks/search-params";

interface Props {
  // Next.js asynchronously provides params
  params: Promise<{ lang: string; category: string; subcategory: string }>;
  searchParams: Promise<SearchParams>;
}

const Page = async ({ params, searchParams }: Props) => {
  const { lang, category, subcategory } = await params;
  const appLang = normalizeToSupported(lang);
  const normalizedCategory = category && category !== "all" ? category : null;
  const filters = await loadTenantFilters(searchParams);

  const queryClient = getQueryClient();

  // Note: getUserProfile is fetched conditionally in TenantList component
  // No need to prefetch here for anonymous users

  // Prefetch tenants with infinite query options
  const base = trpc.tenants.getMany.infiniteQueryOptions(
    {
      // Reuse the shared nuqs loader so filtered deep links hydrate against the
      // same URL-driven state the client reads on first render.
      ...filters,
      // Route-owned category/subcategory stay authoritative over query-state
      // filters so the server prefetch matches TenantList's client-side merge.
      categories: normalizedCategory ? [normalizedCategory] : null,
      subcategory: subcategory ?? null,
      // Viewer coordinates remain client-owned; SSR only mirrors URL state.
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
