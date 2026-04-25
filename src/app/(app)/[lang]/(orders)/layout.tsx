import { Navbar } from "@/modules/home/ui/components/navbar";
import { getQueryClient, trpc } from "@/trpc/server";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

export const dynamic = "force-dynamic";

export default async function OrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();

  // Orders should share the main site navbar so the My Orders entry feels like
  // part of the same shell, but stay task-focused by omitting the footer.
  // Fetch session once here and hydrate that exact result into the navbar cache.
  const session = await queryClient.fetchQuery(
    trpc.auth.session.queryOptions(),
  );

  if (session.user) {
    await Promise.all([
      queryClient.prefetchQuery(trpc.tenants.getMine.queryOptions({})),
      queryClient.prefetchQuery(
        trpc.orders.hasAnyMineSlotLifecycle.queryOptions(),
      ),
    ]);
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Navbar />
        <main className="flex-1">{children}</main>
      </HydrationBoundary>
    </div>
  );
}
