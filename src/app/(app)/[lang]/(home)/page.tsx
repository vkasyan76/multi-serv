import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient, trpc } from "@/trpc/server";

import HomeView from "@/modules/home/ui/HomeView";

export default async function Page() {
  const qc = getQueryClient();
  // Optional: prefetch initial tenants for instant first paint
  await qc.prefetchQuery(trpc.tenants.getMany.queryOptions({ limit: 24 }));

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <HomeView />
    </HydrationBoundary>
  );
}
