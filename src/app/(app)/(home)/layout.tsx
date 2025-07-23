// import configPromise from "@payload-config";
// import { getPayload } from "payload";
// import { Category } from "@/payload-types";

import { Footer } from "@/modules/home/ui/components/footer";
import { Navbar } from "@/modules/home/ui/components/navbar";
import {
  SearchFilters,
  SearchFiltersSkeleton,
} from "@/modules/home/ui/components/search-filters";

import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";

// //  fix for most projects using Clerk, Next.js App Router, and dynamic session UI.
// Clerk can do its server-side/session stuff at runtime, when all required context is present.

export const dynamic = "force-dynamic";

interface Props {
  children: React.ReactNode;
}

const Layout = async ({ children }: Props) => {
  // this is prefetched in a server component before it goes to the client component:
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(trpc.categories.getMany.queryOptions());

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      {/* <SearchFilters data={formatedData} /> */}
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<SearchFiltersSkeleton />}>
          <SearchFilters />
        </Suspense>
      </HydrationBoundary>
      <div className="flex-1 bg-[#F4F4F0]"> {children}</div>
      <Footer />
    </div>
  );
};

export default Layout;
