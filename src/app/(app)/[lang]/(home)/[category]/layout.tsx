import {
  SearchFilters,
  SearchFiltersSkeleton,
} from "@/modules/home/ui/components/search-filters";
import { ReferralNoticeBanner } from "@/modules/home/ui/components/referral-notice-banner";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";

interface Props {
  children: React.ReactNode;
}

const CategoryLayout = async ({ children }: Props) => {
  const queryClient = getQueryClient();
  // Wait for the category query before dehydrating. Kicking off the prefetch
  // without awaiting it can make the server render the Suspense fallback while
  // the client immediately hydrates the resolved filter strip instead.
  await queryClient.prefetchQuery(trpc.categories.getMany.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<SearchFiltersSkeleton />}>
        <SearchFilters />
      </Suspense>
      <ReferralNoticeBanner />
      {children}
    </HydrationBoundary>
  );
};

export default CategoryLayout;
