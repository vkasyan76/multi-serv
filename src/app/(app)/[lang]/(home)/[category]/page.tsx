import type { SearchParams } from "nuqs/server";

import { TenantListView } from "@/modules/tenants/ui/views/tenant-list-view";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient, trpc } from "@/trpc/server";
import { loadTenantFilters } from "@/modules/tenants/hooks/search-params";
import { notFound } from "next/navigation";
import { normalizeToSupported } from "@/lib/i18n/app-lang";

interface Props {
  // Next.js asynchronously provides params
  params: Promise<{ lang: string; category: string }>;
  searchParams: Promise<SearchParams>;
}

const Page = async ({ params, searchParams }: Props) => {
  const { lang, category } = await params;
  const appLang = normalizeToSupported(lang);

  // validate category against your backend list (allow "all")
  const queryClient = getQueryClient();
  const categories = await queryClient.fetchQuery(
    trpc.categories.getMany.queryOptions()
  );

  const isValid =
    category === "all" || categories.some((c) => c.slug === category);

  if (!isValid) notFound(); // <- guard unknown slugs

  // filters

  const filters = await loadTenantFilters(searchParams);

  // after: const filters = await loadTenantFilters(searchParams);

  // The reason you had the TS build error only on the category page was duplicate keys (category from filters + route). On the subcategory page you weren’t spreading ...filters at all, so there were no duplicates—hence no error.
  const normalizedCategory = category === "all" ? null : category;

  // Note: getUserProfile is fetched conditionally in TenantList component
  // No need to prefetch here for anonymous users

  // Prefetch tenants with infinite query options
  const base = trpc.tenants.getMany.infiniteQueryOptions(
    {
      ...filters, // no category/subcategory inside anymore
      category: normalizedCategory, // prefer route param; null for "all"
      subcategory: null,
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
      <TenantListView category={category} />
    </HydrationBoundary>
  );
};

export default Page;
