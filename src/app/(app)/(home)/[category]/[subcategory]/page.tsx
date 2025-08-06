import {
  TenantList,
  TenantListSkeleton,
} from "@/modules/tenants/ui/components/tenant-list";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient, trpc } from "@/trpc/server";
import { Suspense } from "react";
// import { TenantFilters } from "@/modules/tenants/ui/components/tenant-filters";

interface Props {
  // Next.js asynchronously provides params
  params: Promise<{ category: string; subcategory: string }>;
}

const Page = async ({ params }: Props) => {
  const { category, subcategory } = await params;

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    trpc.tenants.getMany.queryOptions({ 
      category: category,      // Parent category
      subcategory: subcategory // Subcategory
    })
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<TenantListSkeleton />}>
        <TenantList category={category} subcategory={subcategory} />
      </Suspense>
    </HydrationBoundary>
  );
};

export default Page;
