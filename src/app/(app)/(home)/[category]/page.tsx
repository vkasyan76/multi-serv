import type { SearchParams } from "nuqs/server";

import {
  TenantList,
  TenantListSkeleton,
} from "@/modules/tenants/ui/components/tenant-list";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient, trpc } from "@/trpc/server";
import { Suspense } from "react";
import { TenantFilters } from "@/modules/tenants/ui/components/tenant-filters";
import { loadTenantFilters } from "@/modules/tenants/hooks/search-params";
import { TenantSort } from "@/modules/tenants/ui/components/tenants-sort";

interface Props {
  // Next.js asynchronously provides params
  params: Promise<{ category: string }>;
  searchParams: Promise<SearchParams>;
}

const Page = async ({ params, searchParams }: Props) => {
  const { category } = await params;

  const filters = await loadTenantFilters(searchParams);

  // console.log(JSON.stringify(filters, null, 2), "THIS IS FROM RCS");

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    trpc.tenants.getMany.queryOptions({ category, ...filters })
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="px-4 lg:px-12 py-8 flex flex-col gap-4">
        {/* Sort  */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-y-2 lg:gap-y-0 justify-between">
          <p className="text-2xl font-medium">Curated for you</p>
          <TenantSort />
        </div>

        {/* Filters & Tenant List */}
        <div className="grid grid-cols-1 lg:grid-cols-6 xl:grid-cols-8 gap-y-6 gap-x-12">
          <div className="lg:col-span-2 xl:col-span-2">
            {/* <div className="border p-2">Tenant Filters</div> */}
            <TenantFilters />
          </div>
          <div className="lg:col-span-4 xl:col-span-6">
            <Suspense fallback={<TenantListSkeleton />}>
              <TenantList category={category} />
            </Suspense>
          </div>
        </div>
      </div>
    </HydrationBoundary>
  );
};

export default Page;
