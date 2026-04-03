// import configPromise from "@payload-config";
// import { getPayload } from "payload";
// import { Category } from "@/payload-types";

import { Footer } from "@/modules/home/ui/components/footer";
import { Navbar } from "@/modules/home/ui/components/navbar";
import {
  SearchFilters,
  SearchFiltersSkeleton,
} from "@/modules/home/ui/components/search-filters";
import { ReferralNotice } from "@/modules/home/ui/components/referral-notice";

import { getQueryClient, trpc } from "@/trpc/server";
import { REFERRAL_NOTICE_COOKIE } from "@/constants";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { cookies } from "next/headers";

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
  // Server-read short-lived referral notice set by /ref/[code] route.
  const jar = await cookies();
  const refNoticeRaw = jar.get(REFERRAL_NOTICE_COOKIE)?.value ?? null;

  return (
    <div className="flex flex-col min-h-screen">
      {/* <SearchFilters data={formatedData} /> */}
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Navbar />
        <Suspense fallback={<SearchFiltersSkeleton />}>
          <SearchFilters />
        </Suspense>
      </HydrationBoundary>
      <ReferralNotice notice={refNoticeRaw} />
      <div className="flex-1 bg-[#F4F4F0]"> {children}</div>
      <Footer />
    </div>
  );
};

export default Layout;
